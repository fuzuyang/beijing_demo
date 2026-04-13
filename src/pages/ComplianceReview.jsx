import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Upload,
  Space,
  message,
  Card,
  Divider,
  Tag,
  Spin,
  Checkbox,
  Popconfirm,
} from "antd";
import {
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  FileSearchOutlined,
  StepBackwardOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import styles from "../styles/ComplianceReview.module.css";
import TitleWithDescription from "../components/TitleWithDescription";
import { complianceApi } from "../services/complianceApi";

const { TextArea } = Input;
const KB_ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

const SOURCE_TRAIL_PATTERN =
  /[\s,，。]*\u6765\u6e90\s*[:：]\s*(?:(?:kb|policy):\/\/[^\s)\]，。；;\n]+(?:\?[^\s)\]，。；;\n]*)?)\s*$/i;
const SOURCE_EMPTY_SUFFIX_PATTERN = /[\s,，。]*\u6765\u6e90\s*[:：]\s*$/i;

const stripInternalSourceRefs = (text) =>
  String(text || "")
    .replace(SOURCE_TRAIL_PATTERN, "")
    .replace(SOURCE_EMPTY_SUFFIX_PATTERN, "")
    .trim();

const isAllowedKbFile = (fileName = "") => {
  const lowerFileName = String(fileName).toLowerCase();
  return KB_ALLOWED_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext));
};

const sanitizeCitations = (citations) => {
  if (!Array.isArray(citations)) return [];
  return citations.map((citation) => ({
    ...citation,
    quote: stripInternalSourceRefs(citation?.quote || ""),
  }));
};

const ComplianceReview = () => {
  const [inputText, setInputText] = useState("");
  const [fileList, setFileList] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [consultationMode, setConsultationMode] = useState("text"); // 'text' or 'file'
  const [showQuickExamples, setShowQuickExamples] = useState(true);
  const [isUploadingKb, setIsUploadingKb] = useState(false);
  const [kbDocuments, setKbDocuments] = useState([]);
  const [selectedKbDocumentIds, setSelectedKbDocumentIds] = useState([]);
  const [isLoadingKbDocuments, setIsLoadingKbDocuments] = useState(false);
  const [isDeletingKbDocuments, setIsDeletingKbDocuments] = useState(false);
  const [streamingText, setStreamingText] = useState(""); // 用于实时显示流式输出
  const [loadingStep, setLoadingStep] = useState(0); // 加载步骤：0-3

  // 加载步骤文字
  const loadingSteps = [
    { text: "正在理解您的问题", completed: "已完成问题理解" },
    { text: "正在检索相关管理文件", completed: "已完成制度检索" },
    { text: "正在筛选最相关条款", completed: "已完成条款筛选" },
    { text: "正在生成答复", completed: "已完成答案生成" },
  ];

  // 加载步骤动画（兜底定时器，后端status事件会直接驱动loadingStep）
  useEffect(() => {
    let timer;
    if (isAnalyzing && !streamingText) {
      timer = setInterval(() => {
        setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 5000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(timer);
  }, [isAnalyzing, streamingText]);

  const fetchKbDocuments = async ({ silent = false } = {}) => {
    try {
      setIsLoadingKbDocuments(true);
      const response = await fetch("/api_beijing/v1/kb/documents", {
        method: "GET",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "获取内部制度文件列表失败");
      }

      const docs = Array.isArray(data?.data?.documents) ? data.data.documents : [];
      setKbDocuments(docs);
      setSelectedKbDocumentIds((prev) =>
        prev.filter((id) => docs.some((doc) => Number(doc?.document_id) === Number(id))),
      );
    } catch (error) {
      if (!silent) {
        const msg = error instanceof Error ? error.message : "获取内部制度文件列表失败";
        message.error(msg);
      }
    } finally {
      setIsLoadingKbDocuments(false);
    }
  };

  useEffect(() => {
    fetchKbDocuments({ silent: true });
  }, []);

  const toggleKbDocumentSelection = (documentId, checked) => {
    const docId = Number(documentId);
    if (!docId) return;
    setSelectedKbDocumentIds((prev) => {
      const exists = prev.includes(docId);
      if (checked && !exists) return [...prev, docId];
      if (!checked && exists) return prev.filter((id) => id !== docId);
      return prev;
    });
  };

  const deleteSelectedKbDocuments = async () => {
    if (!selectedKbDocumentIds.length) {
      message.warning("请先选择要删除的制度文件");
      return;
    }

    try {
      setIsDeletingKbDocuments(true);
      const response = await fetch("/api_beijing/v1/kb/documents/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_ids: selectedKbDocumentIds,
          sync_vector: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "删除制度文件失败");
      }

      const deletedIds = Array.isArray(data?.data?.deleted_document_ids)
        ? data.data.deleted_document_ids.map((id) => Number(id))
        : [];
      if (deletedIds.length) {
        setSelectedKbDocumentIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      }

      if (data?.data?.vector_sync_requested && !data?.data?.vector_sync_ok) {
        message.warning(data?.message || "删除成功，但向量索引同步失败");
      } else {
        message.success(data?.message || "删除成功");
      }
      await fetchKbDocuments({ silent: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "删除制度文件失败";
      message.error(msg);
    } finally {
      setIsDeletingKbDocuments(false);
    }
  };

  // 实际API调用进行合规分析
  const analyzeCompliance = async () => {
    if (
      (consultationMode === "text" && !inputText) ||
      (consultationMode === "file" && fileList.length === 0)
    ) {
      message.error(
        consultationMode === "text" ? "请输入业务事项" : "请上传文件",
      );
      return;
    }

    setIsAnalyzing(true);
    setShowQuickExamples(false); // 隐藏快速示例
    setStreamingText(""); // 重置流式输出
    setAnalysisResult(null); // 重置右边内容

    try {
      let responseData;

      if (consultationMode === "text") {
        // 文字输入模式：使用JSON格式
        // 打印请求数据到控制台
        console.log("发送的请求数据:", { message: inputText });

        // 使用fetch发送请求，处理SSE响应
        const fetchResponse = await fetch("/api_beijing/v1/risk/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: inputText }),
        });

        // 处理SSE响应
        responseData = await handleSSE(fetchResponse);
      } else {
        // 文件上传模式：使用multipart/form-data格式
        // 打印请求数据到控制台
        console.log("发送的请求数据:", {
          message: inputText,
          file: fileList[0].name,
          fileObject: fileList[0],
          hasOriginFileObj: "originFileObj" in fileList[0],
        });

        // 创建FormData对象
        const formData = new FormData();
        // 确保message不为空，即使inputText为空
        formData.append("message", inputText || "请分析上传的文件内容");
        if (fileList.length > 0) {
          // 使用原始的File对象
          formData.append("file", fileList[0].originFileObj);
        }

        // 直接使用fetch发送multipart/form-data请求
        const fetchResponse = await fetch("/api_beijing/v1/risk/evaluate", {
          method: "POST",
          body: formData,
        });

        // 处理SSE响应
        responseData = await handleSSE(fetchResponse);
      }

      // 打印响应状态到控制台
      console.log("响应状态:", 200);

      // 打印完整的后端返回数据到控制台
      console.log("后端返回的完整数据:", responseData);

      // 结果已经在handleSSE函数中处理，这里不再重复处理
      if (!responseData.success) {
        message.error(responseData?.message || "分析失败，请稍后重试");
      }
    } catch (error) {
      console.error("API调用错误:", error);
      message.error("分析过程中出现错误，请稍后重试");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 处理SSE响应
  const handleSSE = (response) => {
    return new Promise((resolve, reject) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultData = null;
      let streamingText = "";

      // token合批：用RAF批量更新，避免每个字符触发一次重渲染
      let pendingTokens = "";
      let rafScheduled = false;
      const flushTokens = () => {
        if (pendingTokens) {
          streamingText += pendingTokens;
          pendingTokens = "";
          setStreamingText(streamingText);
        }
        rafScheduled = false;
      };

      // 后端真实进度阶段映射
      const stageStepMap = { intent: 0, retrieve: 1, analyze: 2, generate: 3 };

      const processChunk = async ({ done, value }) => {
        if (done) {
          flushTokens(); // 确保剩余token全部刷新
          if (resultData) {
            console.log("SSE流结束，返回结果:", resultData);
            resolve(resultData);
          } else {
            reject(new Error("No result received from server"));
          }
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE事件
        const lines = buffer.split("\n");
        buffer = lines.pop(); // 保留最后一行（可能不完整）

        let eventType = "message"; // 默认事件类型

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.substring(6).trim();
            try {
              const data = JSON.parse(dataStr);

              if (eventType === "token") {
                // 合批：积累token，用RAF统一刷新
                pendingTokens += data.delta;
                if (!rafScheduled) {
                  rafScheduled = true;
                  requestAnimationFrame(flushTokens);
                }
              } else if (eventType === "status") {
                // 使用后端真实进度更新加载步骤
                const step = stageStepMap[data.stage];
                if (step !== undefined) setLoadingStep(step);
              } else if (eventType === "result") {
                // 最终结果
                resultData = data;
                console.log("收到result事件:", data);
                // 当收到完整结果时，确保streamingText显示完整的answer
                if (data.data?.answer) {
                  streamingText = data.data.answer;
                  setStreamingText(streamingText);
                }
                // 收到result事件时立即解析并显示结果
                console.log("解析result事件结果:", resultData);

                // 立即处理结果，不需要等待done事件
                if (resultData && resultData.success) {
                  const result = {
                    businessType: "其他",
                    matchedSystems: [],
                    procedures: [],
                    requiredDocuments: [],
                    gaps: [],
                    markdown: resultData.data?.answer || "",
                    citations: sanitizeCitations(
                      resultData.data?.citations || [],
                    ),
                  };

                  console.log("构建的分析结果:", result);
                  console.log("citations详细信息:", result.citations);
                  setAnalysisResult(result);
                  setInputText(""); // 分析成功后清空输入框
                  setFileList([]); // 分析成功后清空文件列表
                  setIsAnalyzing(false); // 立即停止加载状态
                }

                resolve(resultData);
                return;
              } else if (eventType === "done") {
                // 结束标志
                resultData = data;
                console.log("收到done事件:", data);
                // 当收到完整结果时，确保streamingText显示完整的answer
                if (data.data?.answer) {
                  streamingText = data.data.answer;
                  setStreamingText(streamingText);
                }
                // 收到done事件时解析结果
                console.log("解析done事件结果:", resultData);
                resolve(resultData);
                return;
              } else if (eventType === "error") {
                // 错误信息
                reject(new Error(data.message || "Server error"));
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
              console.error("Failed to parse data:", dataStr);
            }
          }
        }

        reader.read().then(processChunk).catch(reject);
      };

      reader.read().then(processChunk).catch(reject);
    });
  };

  // 处理快速示例点击
  const handleExampleClick = (example) => {
    setInputText(example);
  };

  const beforeKbUpload = (file) => {
    if (!isAllowedKbFile(file?.name)) {
      message.error("仅支持 PDF、TXT、MD、DOCX 格式文件");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const uploadInternalPolicy = async ({ file, onSuccess, onError }) => {
    try {
      setIsUploadingKb(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("sync_vector", "1");

      const response = await fetch("/api_beijing/v1/kb/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "上传失败");
      }

      message.success(data?.message || "内部制度文件上传成功");
      await fetchKbDocuments({ silent: true });
      if (onSuccess) onSuccess(data, file);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "内部制度文件上传失败";
      message.error(msg);
      if (onError) onError(error);
    } finally {
      setIsUploadingKb(false);
    }
  };

  // 处理文件上传
  const handleUpload = (file) => {
    // 添加uid、status和name属性，使文件列表显示更美观
    const newFile = {
      ...file,
      uid: file.uid || Date.now(),
      name: file.name,
      status: "done",
      originFileObj: file, // 保存原始的File对象
    };
    setFileList([...fileList, newFile]);
    return false; // 阻止自动上传
  };

  // 处理文件移除
  const handleRemove = (file) => {
    setFileList(fileList.filter((item) => item.uid !== file.uid));
  };

  // 重置表单
  const handleReset = () => {
    setInputText("");
    setFileList([]);
    setAnalysisResult(null);
    setConsultationMode("text"); // 重置为文字输入模式
    setShowQuickExamples(true); // 重置快速示例显示
    setIsAnalyzing(false); // 停止分析
    setStreamingText(""); // 重置流式输出
  };

  // 取消分析
  const handleCancel = () => {
    setIsAnalyzing(false);
    setStreamingText("");
    message.info("分析已取消");
  };

  return (
    <div className={styles.container}>
      <TitleWithDescription
        title="内部合规审查"
        description="输入业务事项或上传请示文件，AI自动识别涉及的制度要求和程序规范"
      />

      <div className={styles.formContainer}>
        <div className={styles.leftPanel}>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>咨询方式</h3>
            <Space style={{ marginBottom: "16px" }}>
              <Button
                style={{
                  backgroundColor:
                    consultationMode === "text" ? "#000" : "#fff",
                  borderColor: consultationMode === "text" ? "#000" : "#d9d9d9",
                  color: consultationMode === "text" ? "#fff" : "#333",
                }}
                onClick={() => {
                  setConsultationMode("text");
                  setAnalysisResult(null);
                  setFileList([]);
                }}
              >
                文字输入
              </Button>
              <Button
                style={{
                  backgroundColor:
                    consultationMode === "file" ? "#000" : "#fff",
                  borderColor: consultationMode === "file" ? "#000" : "#d9d9d9",
                  color: consultationMode === "file" ? "#fff" : "#333",
                }}
                onClick={() => {
                  setConsultationMode("file");
                  setAnalysisResult(null);
                  setInputText("");
                }}
              >
                上传文件
              </Button>
            </Space>

            <div style={{ marginBottom: "16px" }}>
              <Upload
                showUploadList={false}
                accept={KB_ALLOWED_EXTENSIONS.join(",")}
                beforeUpload={beforeKbUpload}
                customRequest={uploadInternalPolicy}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={isUploadingKb}
                  disabled={isUploadingKb}
                >
                  上传内部制度文件
                </Button>
              </Upload>
            </div>

            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                border: "1px solid #e8e8e8",
                borderRadius: "6px",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>已上传内部制度文件</span>
                <Space size={8}>
                  <Button
                    size="small"
                    onClick={() => fetchKbDocuments()}
                    loading={isLoadingKbDocuments}
                  >
                    刷新
                  </Button>
                  <Popconfirm
                    title="确认删除选中的内部制度文件吗？"
                    okText="确认"
                    cancelText="取消"
                    disabled={!selectedKbDocumentIds.length || isDeletingKbDocuments}
                    onConfirm={deleteSelectedKbDocuments}
                  >
                    <Button
                      danger
                      size="small"
                      loading={isDeletingKbDocuments}
                      disabled={!selectedKbDocumentIds.length || isDeletingKbDocuments}
                    >
                      删除选中
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              <div
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  borderTop: "1px solid #f0f0f0",
                  paddingTop: "8px",
                }}
              >
                {isLoadingKbDocuments ? (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <Spin size="small" />
                  </div>
                ) : kbDocuments.length ? (
                  kbDocuments.map((doc) => {
                    const documentId = Number(doc?.document_id);
                    return (
                      <label
                        key={documentId}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "6px 0",
                          cursor: "pointer",
                        }}
                      >
                        <Checkbox
                          checked={selectedKbDocumentIds.includes(documentId)}
                          onChange={(e) =>
                            toggleKbDocumentSelection(documentId, e?.target?.checked)
                          }
                        />
                        <span style={{ fontSize: "12px", color: "#333", lineHeight: 1.5 }}>
                          {doc?.file_name || doc?.document_title || `文档#${documentId}`}
                          <span style={{ color: "#999", marginLeft: "6px" }}>
                            ({doc?.chunk_count ?? 0} 段)
                          </span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ fontSize: "12px", color: "#999", padding: "6px 0" }}>
                    暂无已上传制度文件
                  </div>
                )}
              </div>
            </div>

            {consultationMode === "file" && (
              <>
                <h4
                  style={{
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  上传请示文件
                </h4>
                <Upload
                  fileList={fileList}
                  beforeUpload={handleUpload}
                  onRemove={handleRemove}
                  className="upload-area"
                  style={{ marginBottom: "16px" }}
                >
                  <div
                    style={{
                      border: "1px dashed #d9d9d9",
                      padding: "24px",
                      textAlign: "center",
                      borderRadius: "4px",
                    }}
                  >
                    <UploadOutlined
                      style={{
                        fontSize: "24px",
                        color: "#d9d9d9",
                        marginBottom: "8px",
                      }}
                    />
                    <p style={{ margin: "0 0 4px 0", color: "#333" }}>
                      点击或拖拽上传
                    </p>
                    <p style={{ margin: "0", fontSize: "12px", color: "#999" }}>
                      支持 PDF、DOCX、TXT、MD、CSV
                    </p>
                  </div>
                </Upload>
              </>
            )}

            {consultationMode === "text" && (
              <TextArea
                placeholder="请描述您的业务事项"
                style={{ marginBottom: "8px" }}
                rows={4}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={analyzeCompliance}
              />
            )}
            <p
              style={{
                fontSize: "12px",
                color: "#999",
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: "#f5f5f5",
                borderRadius: "4px",
              }}
            >
              例如：公司注销、股权转让、重大资产处置、对外投资、签订重大合同等...
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#ff9800",
                marginBottom: "16px",
              }}
            >
              💡 提示：可以简单输入事项名称，也可以详细描述具体情况
            </p>

            <div
              className="form-actions"
              style={{ display: "flex", gap: "12px" }}
            >
              <Button
                style={{
                  flex: 1,
                  backgroundColor: "#666",
                  borderColor: "#666",
                  color: "#fff",
                }}
                onClick={analyzeCompliance}
                loading={isAnalyzing}
              >
                开始分析
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </div>
          </div>

          {showQuickExamples && (
            <div className={styles.quickExamples}>
              <h3 className={styles.sectionTitle}>快速示例</h3>
              <div className={styles.exampleTags}>
                <div
                  className={styles.tag}
                  onClick={() => handleExampleClick("公司注销")}
                >
                  公司注销
                </div>
                <div
                  className={styles.tag}
                  onClick={() => handleExampleClick("股权转让")}
                >
                  股权转让
                </div>
                <div
                  className={styles.tag}
                  onClick={() => handleExampleClick("对外投资")}
                >
                  对外投资
                </div>
                <div
                  className={styles.tag}
                  onClick={() => handleExampleClick("重大合同签订")}
                >
                  重大合同签订
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.rightPanel}>
          {analysisResult ? (
            <Card
              title="分析结果"
              style={{ minHeight: "600px", height: "auto" }}
            >
              {/* 统一显示格式：只显示markdown内容和Citations */}
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "16px",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    minHeight: "200px",
                    overflowY: "auto",
                    marginBottom: "24px",
                  }}
                >
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "14px",
                      lineHeight: "1.8",
                      color: "#000",
                    }}
                  >
                    {analysisResult.markdown || "无分析报告"}
                  </pre>
                </div>

                {/* 显示Citations */}
                <div
                  style={{
                    marginTop: "24px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "12px",
                      margin: 0,
                      paddingBottom: "12px",
                      borderBottom: "1px solid #e8e8e8",
                    }}
                  >
                    Citations
                  </h3>
                  <div style={{ wordBreak: "break-word" }}>
                    {analysisResult.citations &&
                    typeof analysisResult.citations === "object" &&
                    analysisResult.citations.length > 0 ? (
                      Object.values(analysisResult.citations).map(
                        (citation, index) => {
                          const cleanQuote = stripInternalSourceRefs(
                            citation.quote || "",
                          );
                          return (
                            <p
                              key={index}
                              style={{
                                marginBottom: "12px",
                                wordBreak: "break-word",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              <strong>[{index + 1}]</strong>{" "}
                              {citation.source_title} {citation.section_title}{" "}
                              {citation.subsection_title}，{cleanQuote}
                            </p>
                          );
                        },
                      )
                    ) : (
                      <p style={{ color: "#999" }}>暂无引用</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : isAnalyzing ? (
            <Card
              title="分析结果"
              style={{ minHeight: "600px", height: "auto" }}
            >
              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "16px",
                  borderRadius: "4px",
                  minHeight: "500px",
                  display: "flex",
                  alignItems: streamingText ? "flex-start" : "center",
                  justifyContent: streamingText ? "flex-start" : "center",
                }}
              >
                {streamingText ? (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      width: "100%",
                    }}
                  >
                    {streamingText}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      animation: "fadeIn 0.5s ease-in",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-block",
                        width: "40px",
                        height: "40px",
                        border: "4px solid #1890ff",
                        borderTop: "4px solid transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginBottom: "20px",
                      }}
                    />
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "500",
                        color: "#000",
                      }}
                    >
                      {loadingSteps[loadingStep]?.text ?? loadingSteps[3].text}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <Button onClick={handleCancel} style={{ marginRight: "12px" }}>
                  取消分析
                </Button>
                <Button type="primary" disabled>
                  联系客服
                </Button>
              </div>
            </Card>
          ) : (
            <div
              style={{
                padding: "24px",
                border: "1px solid #e8e8e8",
                borderRadius: "8px",
                minHeight: "150px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <FileTextOutlined
                  style={{
                    fontSize: "36px",
                    color: "#d9d9d9",
                    marginBottom: "12px",
                  }}
                />
                <p
                  style={{
                    fontSize: "14px",
                    color: "#999",
                    marginBottom: "6px",
                  }}
                >
                  请输入业务事项或上传文件
                </p>
                <p style={{ fontSize: "12px", color: "#999" }}>
                  AI将自动识别涉及的制度要求和程序规范
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceReview;
