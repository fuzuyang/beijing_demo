import React, { useState, useRef, useCallback } from "react";
import styles from "../styles/InternalDraft.module.css";
import TitleWithDescription from "../components/TitleWithDescription";

const InternalDraft = () => {
  // 状态管理
  const [leftFiles, setLeftFiles] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [fileType, setFileType] = useState(""); // 用户传入的文件类型
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);
  const streamingTextRef = useRef(""); // 用于实时跟踪流式文本
  const abortControllerRef = useRef(null);
  const isProcessingRef = useRef(false); // 标记是否正在处理 SSE 事件

  // 模板类型映射 (前端值 -> 后端值)
  const templateMapping = {
    case_report: "1",
    case_litigation_plan: "2",
    hire_external_lawyer: "3",
  };

  // 处理文件选择
  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    // 只保留 PDF 文件
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length !== files.length) {
      setErrorMessage("仅支持 PDF 格式文件");
      setTimeout(() => setErrorMessage(""), 3000);
    }
    setLeftFiles((prev) => [...prev, ...pdfFiles]);
  }, []);

  // 删除文件
  const handleRemoveFile = useCallback((index) => {
    setLeftFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 处理拖拽上传
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length !== files.length) {
      setErrorMessage("仅支持 PDF 格式文件");
      setTimeout(() => setErrorMessage(""), 3000);
    }
    setLeftFiles((prev) => [...prev, ...pdfFiles]);
  }, []);

  // 处理 SSE 流式响应
  const handleSSEResponse = useCallback(
    async (response) => {
      isProcessingRef.current = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) continue;
            if (line.startsWith("data:")) {
              const dataStr = line.substring(5).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                console.log("Received data:", data);

                if (data.delta !== undefined && isProcessingRef.current) {
                  // 只更新 ref，不更新状态，避免界面闪烁
                  streamingTextRef.current += data.delta;
                  // 异步更新状态，避免阻塞
                  setStreamingText((prev) => prev + data.delta);
                } else if (data.status === true && data.data) {
                  console.log("Final result received");
                  isProcessingRef.current = false;

                  // 立即使用 ref 中的完整文本创建文档
                  setGeneratedDocument({
                    title: getTemplateName(selectedTemplate),
                    content: streamingTextRef.current || "生成的内容为空",
                    rowId: data.data.row_id,
                    fileType: data.data.file_type,
                    expectedTemplate: data.data.expected_template,
                  });

                  // 清空状态
                  setStreamingText("");
                  setIsSubmitting(false);
                  return;
                } else if (data.status === false && data.message) {
                  throw new Error(data.message);
                } else if (data.success !== undefined) {
                  if (!data.success) {
                    throw new Error("生成失败");
                  } else {
                    isProcessingRef.current = false;
                    return;
                  }
                }
              } catch (parseError) {
                console.error("Parse error:", parseError, dataStr);
              }
            }
          }
        }
      } catch (error) {
        console.error("SSE error:", error);
        setErrorMessage("生成过程中发生错误");
        setIsSubmitting(false);
        isProcessingRef.current = false;
      } finally {
        reader.releaseLock();
      }
    },
    [selectedTemplate],
  );

  // 获取模板显示名称
  const getTemplateName = (templateValue) => {
    const mapping = {
      case_report: "案件报告",
      case_litigation_plan: "案件诉讼方案请示",
      hire_external_lawyer: "聘请外部律师请示",
    };
    return mapping[templateValue] || "生成的文档";
  };

  // 生成文档
  const handleGenerate = useCallback(async () => {
    if (leftFiles.length === 0) {
      setErrorMessage("请先上传文件");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    if (!selectedTemplate) {
      setErrorMessage("请选择文档模板");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    if (!fileType) {
      setErrorMessage("请选择文件类型");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    const expectedTemplate = templateMapping[selectedTemplate];
    if (!expectedTemplate) {
      setErrorMessage("无效的模板类型");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    setIsSubmitting(true);
    setStreamingText("");
    setGeneratedDocument(null);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", leftFiles[0]);
    formData.append("file_type", fileType);
    formData.append("expected_template", expectedTemplate);

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, 120000);

    try {
      const response = await fetch("/upload/document", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        await handleSSEResponse(response);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "请求失败");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setErrorMessage("请求超时，请稍后重试");
      } else {
        setErrorMessage(error.message || "生成失败，请重试");
      }
      console.error("Generate error:", error);
      setIsSubmitting(false); // 错误时也要结束提交状态
    } finally {
      abortControllerRef.current = null;
    }
  }, [leftFiles, selectedTemplate, fileType, handleSSEResponse]);

  // 重置表单 - 只重置上传文件和模板选择，保留生成的文档
  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLeftFiles([]);
    setSelectedTemplate("");
    setFileType(""); // 重置文件类型
    setStreamingText("");
    setErrorMessage("");
    setIsSubmitting(false); // 重置提交状态
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // 下载文档
  const handleDownload = useCallback(() => {
    if (!generatedDocument) return;

    const textContent = generatedDocument.content;
    const fileName = `${generatedDocument.title}.txt`;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedDocument]);

  // 新建文档 - 完全重置所有状态
  const handleNewDocument = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLeftFiles([]);
    setSelectedTemplate("");
    setStreamingText("");
    setGeneratedDocument(null);
    setErrorMessage("");
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className={styles.container}>
      <TitleWithDescription
        title="内部行政文书起草"
        description="上传背景材料，选择模板，自动生成标准化审批文件"
      />

      {errorMessage && (
        <div className={styles.errorToast}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")}>×</button>
        </div>
      )}

      <div className={styles.mainContent}>
        <div className={styles.leftSection}>
          <div className={styles.uploadCard}>
            <h3 className={styles.cardTitle}>上传材料文档</h3>
            <div
              className={styles.uploadArea}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <div className={styles.uploadIcon}>
                <svg
                  viewBox="0 0 24 24"
                  width="48"
                  height="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              </div>
              <p className={styles.uploadText}>点击上传或拖拽文件到此处</p>
              <p className={styles.uploadHint}>仅支持 PDF 格式</p>
            </div>

            {leftFiles.length > 0 && (
              <div className={styles.fileList}>
                {leftFiles.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <span className={styles.fileName} title={file.name}>
                      {file.name}
                    </span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveFile(index)}
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.templateCard}>
            <h3 className={styles.cardTitle}>选择文档模板</h3>
            <div className={styles.selectWrapper}>
              <select
                className={styles.templateSelect}
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">请选择要生成的文档类型</option>
                <option value="case_report">案件报告</option>
                <option value="case_litigation_plan">案件诉讼方案请示</option>
                <option value="hire_external_lawyer">聘请外部律师请示</option>
              </select>
              <span className={styles.selectArrow}>▼</span>
            </div>
          </div>

          <div className={styles.templateCard}>
            <h3 className={styles.cardTitle}>文件类型</h3>
            <div className={styles.selectWrapper}>
              <select
                className={styles.templateSelect}
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">请选择文件类型</option>
                <option value="1">律师意见书</option>
                <option value="2">起诉状</option>
              </select>
              <span className={styles.selectArrow}>▼</span>
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button
              className={styles.generateBtn}
              disabled={
                isSubmitting ||
                leftFiles.length === 0 ||
                !selectedTemplate ||
                !fileType
              }
              onClick={handleGenerate}
            >
              <svg
                className={styles.btnIcon}
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              {isSubmitting ? "生成中..." : "生成文档"}
            </button>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <h3 className={styles.cardTitle}>文档预览</h3>
              {generatedDocument && (
                <div className={styles.previewActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.downloadBtn}`}
                    onClick={handleDownload}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    下载文档
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.newDocumentBtnAlt}`}
                    onClick={handleNewDocument}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    新建文档
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.resetBtnAlt}`}
                    onClick={handleReset}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.18-3.185m-3.18-3.182v4.992m0 0h-4.992m4.992 0l-3.182-3.182a8.25 8.25 0 00-11.664 0l-3.18 3.185"
                      />
                    </svg>
                    重新上传
                  </button>
                </div>
              )}
            </div>
            <div className={styles.previewContent}>
              {generatedDocument ? (
                <div className={styles.documentResult}>
                  <h4>{generatedDocument.title}</h4>
                  <div className={styles.documentBody}>
                    {generatedDocument.content}
                  </div>
                </div>
              ) : isSubmitting ? (
                <div className={styles.streamingArea}>
                  <div className={styles.streamingText}>
                    {streamingText || "正在生成文档内容..."}
                  </div>
                  {streamingText && <span className={styles.cursor}>|</span>}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <svg
                      viewBox="0 0 24 24"
                      width="64"
                      height="64"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <p className={styles.emptyText}>
                    上传文件并选择模板后，点击生成按钮
                  </p>
                  <p className={styles.emptyHint}>生成的文档将在此处显示</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalDraft;
