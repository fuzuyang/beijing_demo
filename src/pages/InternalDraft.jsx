// 导入 React 库，特别是 useState 和 useEffect 钩子，用于在函数组件中管理状态和副作用
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
// 导入此组件专用的 CSS 模块，用于样式化
import styles from "../styles/InternalDraft.module.css";
// 导入一个可重用的标题组件
import TitleWithDescription from "../components/TitleWithDescription";

// 定义 InternalDraft 组件，这是一个函数式组件
const InternalDraft = () => {
  // --- 状态管理 (State Management) ---
  // 上传的文件列表
  const [leftFiles, setLeftFiles] = useState([]);
  // 用户选择的文档模板
  const [selectedTemplate, setSelectedTemplate] = useState("");
  // 标记当前是否正在向后端提交数据（用于禁用按钮，防止重复提交）
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 显示给用户的消息（如"生成中..."、"上传成功"等）
  const [message, setMessage] = useState("");
  // 保存从后端接收到的已生成文档的数据
  const [generatedDocument, setGeneratedDocument] = useState(null);
  // 当前加载步骤索引
  const [loadingStep, setLoadingStep] = useState(0);
  // 实时生成的文本
  const [streamingText, setStreamingText] = useState("");
  // 显示滚动到底部按钮
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // 用于跟踪组件是否仍然挂载的ref
  const isMountedRef = useRef(true);
  
  // 用于滚动容器的ref
  const streamingContentRef = useRef(null);
  
  // 记录上次文本长度，用于检测新内容
  const lastTextLengthRef = useRef(0);
  
  // 使用ref来跟踪streamingText的最新值
  const streamingTextRef = useRef("");
  
  // 用于批量收集待显示的文本
  const pendingTextRef = useRef("");
  const updatePendingRef = useRef(false);
  const animationFrameRef = useRef(null);
  
  // 滚动控制相关的refs
  const isUserNearBottomRef = useRef(true);
  const userScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  
  // 加载步骤
  const steps = [
    "正在解析文档要素",
    "正在生成文档模板",
    "正在优化内容",
    "文档生成完成"
  ];
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // 清理动画帧
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // 清理滚动定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 监听用户滚动事件
  useEffect(() => {
    const container = streamingContentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceToBottom < 100;
      isUserNearBottomRef.current = nearBottom;
      
      // 控制按钮显示（距离底部超过200px时显示）
      setShowScrollButton(distanceToBottom > 200);
      
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // 用户停止滚动后，判断用户意图
      scrollTimeoutRef.current = setTimeout(() => {
        if (!nearBottom) {
          // 用户向上滚动离开底部，标记为用户主动滚动
          userScrolledRef.current = true;
        } else {
          // 用户滚回底部，重置用户意图标志
          userScrolledRef.current = false;
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 智能滚动到底部函数 - 已禁用自动滚动
  const smartScrollToBottom = useCallback(() => {
    // 自动滚动已禁用，用户需要手动滚动
    return;
  }, []);

  // 手动滚动到底部
  const scrollToBottomManually = useCallback(() => {
    if (streamingContentRef.current) {
      streamingContentRef.current.scrollTo({
        top: streamingContentRef.current.scrollHeight,
        behavior: 'smooth'
      });
      // 重置用户滚动状态
      userScrolledRef.current = false;
      isUserNearBottomRef.current = true;
    }
  }, []);

  // 重置用户滚动状态
  const resetUserScrollState = useCallback(() => {
    userScrolledRef.current = false;
    isUserNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // 批量更新文本的函数 - 直接更新，不延迟
  const appendTextBatch = useCallback((newDelta) => {
    setStreamingText(prev => prev + newDelta);
  }, []);

  // 处理SSE响应
  const handleSSE = useCallback((response) => {
    return new Promise((resolve, reject) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultData = null;
      let isResolved = false;

      // 后端真实进度阶段映射
      const stageStepMap = { start: 0, generate: 1, evaluate: 2, complete: 3 };

      const processChunk = async ({ done, value }) => {
        if (done) {
          if (!isResolved && isMountedRef.current) {
            if (resultData) {
              resolve(resultData);
            } else {
              reject(new Error("No result received from server"));
            }
          }
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE事件
        const lines = buffer.split("\n");
        buffer = lines.pop();

        let eventType = "message";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.substring(6).trim();
            try {
              const data = JSON.parse(dataStr);

              if (eventType === "token") {
                // 使用批量更新
                appendTextBatch(data.delta);
                console.log("收到SSE token事件:", data);
              } else if (eventType === "status") {
                const step = stageStepMap[data.stage];
                if (step !== undefined && isMountedRef.current) {
                  setLoadingStep(step);
                }
              } else if (eventType === "result") {
                resultData = data;
                if (isMountedRef.current) {
                  setLoadingStep(3);
                }
                if (!isResolved) {
                  isResolved = true;
                  resolve(resultData);
                }
                return;
              } else if (eventType === "error") {
                if (!isResolved) {
                  isResolved = true;
                  reject(new Error(data.message || "Server error"));
                }
                return;
              } else if (eventType === "done") {
                resultData = data;
                if (isMountedRef.current) {
                  setLoadingStep(3);
                }
                if (!isResolved) {
                  isResolved = true;
                  resolve(resultData);
                }
                return;
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }

        reader.read().then(processChunk).catch(reject);
      };

      reader.read().then(processChunk).catch(reject);
    });
  }, [appendTextBatch]);

  // --- 核心功能：生成文档 ---
  const handleGenerateDocument = useCallback(async () => {
    // 验证：确保用户已上传文件并选择了模板
    if (leftFiles.length === 0 || !selectedTemplate) {
      setMessage("请上传文件并选择模板");
      return;
    }

    // 验证文件类型，仅支持PDF
    for (const file of leftFiles) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setMessage("仅支持PDF文件");
        return;
      }
    }

    // 重置所有状态
    setIsSubmitting(true);
    setMessage("");
    setGeneratedDocument(null);
    setStreamingText("");
    streamingTextRef.current = "";
    setLoadingStep(0);
    lastTextLengthRef.current = 0;
    updatePendingRef.current = false;
    
    // 重置滚动状态
    resetUserScrollState();

    // 兜底定时器
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2000);

    try {
      // 准备FormData
      const formData = new FormData();
      const file = leftFiles[0];
      if (file) {
        formData.append("file", file);
      }
      
      const templateMap = {
        case_report: "1",
        lawsuit_request: "2",
        external_lawyer: "3"
      };
      
      formData.append("file_type", "1");
      formData.append("expected_template", templateMap[selectedTemplate] || "1");

      // 发送请求
      const response = await fetch("/upload/document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('text/event-stream')) {
        result = await handleSSE(response);
        console.log("后端返回的数据:", result);
        clearInterval(stepInterval);
        
        let documentContent = "";
        
        if (result && (result.status || result.success)) {
          documentContent = result.data?.generated_answer || streamingTextRef.current || "";
          
          const document = {
            title: "生成的文档",
            reportNumber: "DOC-" + Date.now(),
            reportDate: new Date().toISOString().split('T')[0],
            sections: [
              {
                title: "文档内容",
                content: documentContent,
                points: []
              }
            ]
          };
          
          if (isMountedRef.current) {
            setGeneratedDocument(document);
            setMessage("文档生成成功！");
            setLeftFiles([]);
          }
        } else {
          if (isMountedRef.current) {
            setMessage(result?.message || "生成文档失败");
          }
        }
        
        if (isMountedRef.current) {
          setLoadingStep(3);
          setIsSubmitting(false);
        }
      } else {
        result = await response.json();
        
        if (isMountedRef.current) {
          if (result.status || result.success) {
            const document = {
              title: "生成的文档",
              reportNumber: "DOC-" + Date.now(),
              reportDate: new Date().toISOString().split('T')[0],
              sections: [
                {
                  title: "文档内容",
                  content: result.data?.generated_answer || "",
                  points: []
                }
              ]
            };
            setGeneratedDocument(document);
            setLoadingStep(3);
            setMessage("文档生成成功！");
            setLeftFiles([]);
          } else {
            setMessage(result.message || "生成文档失败");
            setLoadingStep(0);
          }
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setMessage("生成文档失败，请重试");
        setIsSubmitting(false);
        setLoadingStep(0);
      }
      console.error("文档生成请求失败:", error);
    } finally {
      clearInterval(stepInterval);
    }
  }, [leftFiles, selectedTemplate, handleSSE, resetUserScrollState, steps.length]);

  // 辅助函数：获取模板名称
  const getTemplateName = useCallback((templateValue) => {
    const templateMap = {
      case_report: "案件报告",
      lawsuit_request: "案件诉讼方案请示",
      external_lawyer: "聘请外部律师的请示",
      legal_opinion: "法律意见书",
      contract_review: "合同审查报告",
    };
    return templateMap[templateValue] || templateValue;
  }, []);

  // 事件处理函数
  const handleFileUpload = useCallback((e) => {
    const uploadedFiles = Array.from(e.target.files);
    setLeftFiles((prevFiles) => [...prevFiles, ...uploadedFiles]);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleLeftDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setLeftFiles((prevFiles) => [...prevFiles, ...droppedFiles]);
  }, []);

  const handleRemoveLeftFile = useCallback((indexToRemove) => {
    setLeftFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  const handleTemplateChange = useCallback((e) => {
    setSelectedTemplate(e.target.value);
  }, []);

  // 保存和恢复滚动位置，防止滚动条跳到顶部
  const scrollPositionRef = useRef(0);
  useEffect(() => {
    const container = streamingContentRef.current;
    if (container) {
      // 保存当前滚动位置
      scrollPositionRef.current = container.scrollTop;
      
      // 在下一个事件循环中恢复滚动位置
      setTimeout(() => {
        if (container) {
          container.scrollTop = scrollPositionRef.current;
        }
      }, 0);
    }
  }, [streamingText]);

  // 使用 useMemo 缓存渲染结果
  const streamingTextElement = useMemo(() => {
    if (!streamingText || streamingText.length === 0) return null;
    
    return (
      <div
        key="streaming-text"
        style={{
          whiteSpace: "pre-wrap",
          fontSize: "14px",
          lineHeight: "1.6",
          width: "100%",
        }}
      >
        {streamingText}
      </div>
    );
  }, [streamingText]);

  const loadingElement = useMemo(() => (
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
          marginBottom: "30px",
        }}
      >
        {steps[loadingStep] || "正在生成文档内容..."}
      </div>
      <div style={{ textAlign: "left", maxWidth: "400px", margin: "0 auto" }}>
        {steps.map((step, index) => (
          <p key={index} style={{ 
            margin: "8px 0", 
            fontSize: "14px",
            color: index <= loadingStep ? "#1890ff" : "#999",
            display: "flex",
            alignItems: "center"
          }}>
            <span style={{ 
              display: "inline-block", 
              width: "20px", 
              height: "20px", 
              borderRadius: "50%", 
              backgroundColor: index <= loadingStep ? "#1890ff" : "#e8e8e8",
              color: "white",
              textAlign: "center",
              lineHeight: "20px",
              fontSize: "12px",
              marginRight: "12px"
            }}>
              {index === loadingStep ? "⏳" : index < loadingStep ? "✓" : "○"}
            </span>
            {step}
          </p>
        ))}
      </div>
    </div>
  ), [loadingStep, steps]);

  // --- UI 渲染 ---
  return (
    <div className={styles.container}>
      <TitleWithDescription
        title="内部行政文书起草"
        description="上传背景材料，选择模板，自动生成标准化审批文件"
      />

      <div className={styles.mainContent}>
        {/* 左侧区域 */}
        <div className={styles.leftSection}>
          {/* 文件上传部分 */}
          <div className={styles.uploadSection}>
            <h3 className={styles.uploadSectionTitle}>上传材料文档</h3>
            <div className={styles.uploadContainer}>
              <div className={styles.uploadAreaWrapper}>
                <div
                  className={styles.uploadArea}
                  onDragOver={handleDragOver}
                  onDrop={handleLeftDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={styles.uploadLabel}
                  >
                    <div className={styles.uploadIcon}>⬆</div>
                    <p className={styles.uploadText}>
                      点击上传或拖拽文件到此处
                    </p>
                    <p className={styles.uploadFormat}>
                      支持 PDF, DOC, DOCX, TXT 等格式
                    </p>
                  </label>

                  {leftFiles.length > 0 && (
                    <div className={styles.fileList}>
                      <h4>已上传文件：</h4>
                      <ul>
                        {leftFiles.map((file, index) => (
                          <li key={index} className={styles.fileItem}>
                            {file.name}
                            <button
                              className={styles.removeFileButton}
                              onClick={() => handleRemoveLeftFile(index)}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 模板选择部分 */}
          <div className={styles.templateSection}>
            <h3 className={styles.templateSectionTitle}>选择文档模板</h3>
            <select
              className={styles.selectTemplate}
              value={selectedTemplate}
              onChange={handleTemplateChange}
            >
              <option value="" disabled hidden>
                请选择要生成的文档类型
              </option>
              <option value="case_report">案件报告</option>
              <option value="lawsuit_request" disabled>
                案件诉讼方案请示
              </option>
              <option value="external_lawyer" disabled>
                聘请外部律师的请示
              </option>
              <option value="legal_opinion" disabled>
                法律意见书
              </option>
              <option value="contract_review" disabled>
                合同审查报告
              </option>
            </select>
          </div>

          {/* 生成按钮部分 */}
          <div className={styles.generateSection}>
            <button
              className={styles.generateButton}
              onClick={handleGenerateDocument}
              disabled={isSubmitting}
            >
              {isSubmitting ? "生成中..." : "📄 生成文档"}
            </button>
            {message && <p className={styles.message}>{message}</p>}
          </div>
        </div>

        {/* 右侧区域 - 文档预览 */}
        <div className={styles.rightSection}>
          <div className={styles.previewHeader}>
            <h3 className={styles.previewSectionTitle}>文档预览</h3>
            {generatedDocument && (
              <button className={styles.downloadButton}>📥 下载文档</button>
            )}
          </div>

          {generatedDocument ? (
            <div className={styles.documentPreview}>
              <h4 className={styles.documentTitle}>
                {generatedDocument.title}
              </h4>
              <div className={styles.documentMeta}>
                <p>报告编号: {generatedDocument.reportNumber}</p>
                <p>报告日期: {generatedDocument.reportDate}</p>
              </div>

              <div className={styles.documentContent}>
                {generatedDocument.sections.map((section, index) => (
                  <div key={index} className={styles.documentSection}>
                    <h5 className={styles.sectionTitle}>{section.title}</h5>
                    <p className={styles.sectionContent}>{section.content}</p>

                    {section.points &&
                      section.points.map((point, pointIndex) => (
                        <div key={pointIndex} className={styles.sectionPoint}>
                          {typeof point === "string" ? (
                            <p>{point}</p>
                          ) : (
                            <>
                              <p>{point.text}</p>
                              <ul className={styles.subPoints}>
                                {point.subPoints.map((subPoint, subIndex) => (
                                  <li key={subIndex}>{subPoint}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          ) : isSubmitting ? (
            // 实时生成文本显示区域
            <div style={{ minHeight: "600px", height: "auto", position: "relative" }}>
              <div
                ref={streamingContentRef}
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "16px",
                  borderRadius: "4px",
                  height: "600px",
                  overflowY: "auto",
                  position: "relative",
                  scrollBehavior: "auto"
                }}
              >
                {streamingText && streamingText.length > 0 ? (
                  streamingTextElement
                ) : (
                  loadingElement
                )}
              </div>
              
              {/* 滚动到底部按钮 */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottomManually}
                  style={{
                    position: "absolute",
                    bottom: "20px",
                    right: "20px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "20px",
                    backgroundColor: "#1890ff",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    zIndex: 1000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    transition: "all 0.3s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#40a9ff";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#1890ff";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  ↓
                </button>
              )}
            </div>
          ) : (
            // 空状态显示
            <div className={styles.previewArea}>
              {(leftFiles.length > 0) && selectedTemplate ? (
                <div className={styles.previewContent}>
                  <h4>预览内容</h4>
                  <p>已上传 {leftFiles.length} 个文件</p>
                  <p>选择的模板：{getTemplateName(selectedTemplate)}</p>
                  <p className={styles.previewHint}>
                    点击生成文档按钮后，生成的内容将在此处显示
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.previewIcon}>📄</div>
                  <p className={styles.previewText}>
                    上传文件并选择模板后，点击生成按钮
                  </p>
                  <p className={styles.previewSubtext}>
                    生成的文档将在此处显示
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 导出组件，使用 React.memo 优化性能
export default React.memo(InternalDraft);