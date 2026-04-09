import React, { useState, useEffect } from 'react';
import StepsIndicator from '../components/StepsIndicator';
import TitleWithDescription from '../components/TitleWithDescription';
import styles from '../styles/FlowChart.module.css';
import { Upload, Button, message, Table, Card } from 'antd';
import { UploadOutlined,  LoadingOutlined} from '@ant-design/icons';
import { ReactFlow, ReactFlowProvider,Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'reactflow/dist/style.css';

const formatDataFromBackend = (data) => {
  console.log(data, 'formatDataFromBackend');
  if (!data || data.chartNodeInfo.length === 0) {
    return {
          nodes: [
            { id: 1, name: '发起申请', type: 'start', position: { x: 400, y: 50 }, assignee: '申请人' },
            { id: 2, name: '部门审核', type: 'process', position: { x: 400, y: 150 }, assignee: '部门主管' },
            { id: 3, name: '风险评估', type: 'process', position: { x: 400, y: 250 }, assignee: '风险部门' },
            { id: 4, name: '财务审批', type: 'decision', position: { x: 400, y: 350 }, assignee: '财务总监' },
            { id: 5, name: '总经理审批', type: 'decision', position: { x: 400, y: 450 }, assignee: '总经理' },
            { id: 6, name: '执行实施', type: 'process', position: { x: 400, y: 550 }, assignee: '执行部门' },
            { id: 7, name: '归档存档', type: 'end', position: { x: 400, y: 650 }, assignee: '行政部' }
          ],
          edges: [
            { from: 1, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 4 },
            { from: 4, to: 5 },
            { from: 5, to: 6 },
            { from: 6, to: 7 }
          ]
        };
  }
  const length = data.chartNodeInfo.length;
  const positionX = 400;
  const positionY = 50;
  const nodes = data.chartNodeInfo.map((node, index) => ({
    id: index + 1,
    name: node.nodeName,
    type: index===0 ? 'start' : index === length - 1 ? 'end' : 'process',
    position: { x: positionX, y: positionY + index * 100 },
    assignee: node.assignee
  }));
  const edges = nodes.map((node) => ({
    from: node.id,
    to: node.id + 1,
  }));
  return {
    nodes,
    edges
  };
};

const FlowChart = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [dataSource,setDataSource] = useState([]);
  const [flowData, setFlowData] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [typeCount, setTypeCount] = useState({output: 0, input: 0});
  const [fileList, setFileList] = useState([]);
  const [uploadUrl, setUploadUrl] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);



  // 模拟步骤流程
  // useEffect(() => {
  //   let timer;
    
  //   if (activeStep === 1) {
  //     // 等待用户上传文件
  //   } else if (activeStep === 2) {
  //     // 模拟AI识别过程
  //     timer = setTimeout(() => {
  //       setActiveStep(3);
  //       // 模拟从后端获取流程图数据
  //       setFlowData({
  //         nodes: [
  //           { id: 1, name: '发起申请', type: 'start', position: { x: 400, y: 50 }, assignee: '申请人' },
  //           { id: 2, name: '部门审核', type: 'process', position: { x: 400, y: 150 }, assignee: '部门主管' },
  //           { id: 3, name: '风险评估', type: 'process', position: { x: 400, y: 250 }, assignee: '风险部门' },
  //           { id: 4, name: '财务审批', type: 'decision', position: { x: 400, y: 350 }, assignee: '财务总监' },
  //           { id: 5, name: '总经理审批', type: 'decision', position: { x: 400, y: 450 }, assignee: '总经理' },
  //           { id: 6, name: '执行实施', type: 'process', position: { x: 400, y: 550 }, assignee: '执行部门' },
  //           { id: 7, name: '归档存档', type: 'end', position: { x: 400, y: 650 }, assignee: '行政部' }
  //         ],
  //         edges: [
  //           { from: 1, to: 2 },
  //           { from: 2, to: 3 },
  //           { from: 3, to: 4 },
  //           { from: 4, to: 5 },
  //           { from: 5, to: 6 },
  //           { from: 6, to: 7 }
  //         ]
  //       });
  //     }, 4000);
  //   }
    
  //   return () => clearTimeout(timer);
  // }, [activeStep]);

  useEffect(() => {
    if (uploadUrl) {
      // 调用后端接口获取流程图数据
      fetch(`https://www.countmeout.top:3001/api/mock/generateFile`,{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            file: uploadUrl
          }
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('Backend response:', data);
          setTypeCount({input: data.data?.inputTypeCount || 0, output: data.data?.outputTypeCount || 0});
          // 格式化数据 绘制流程图
          const chartNodes = formatDataFromBackend(data.data || null);
          setFlowData(chartNodes);
          setDataSource(data.data?.chartNodeInfo || []);
          // 设置markdown内容，如果后端没有返回则使用默认内容
          const backendDoc = data.data?.doc || '';
          if (backendDoc) {
            setMarkdown(backendDoc);
          } else {
            // 默认内控手册内容
            setMarkdown(`# 采购报销流程内控手册

## 1. 流程概述

本流程描述了从申请人提交申请到财务付款的完整采购报销流程，涵盖了部门负责人审核、财务部门初审、财务负责人复审、领导终审等环节。

## 2. 流程节点说明

- **申请人提交申请**：申请人填写报销申请，提交相关凭证
- **部门负责人审核**：部门负责人审核申请的真实性和合理性
- **财务部门初审**：财务部门审核申请的合规性和票据的有效性
- **财务负责人复审**：财务负责人对初审通过的申请进行复审
- **领导终审**：公司领导对金额较大或特殊的报销申请进行最终审批
- **财务付款**：财务部门根据审批结果进行付款

## 3. 责任分工

| 流程节点 | 责任部门/人 |
|---------|------------|
| 申请人提交申请 | 申请人 |
| 部门负责人审核 | 部门负责人 |
| 财务部门初审 | 财务部门 |
| 财务负责人复审 | 财务负责人 |
| 领导终审 | 公司领导 |
| 财务付款 | 财务部门 |

## 4. 输入输出物

### 输入物
- 报销申请表
- 发票等原始凭证
- 采购合同（如需）

### 输出物
- 审批通过的报销申请
- 付款凭证
- 财务记账凭证

## 5. 风险控制点

- 票据真实性审核：确保发票等凭证真实有效
- 金额合理性审核：确保报销金额符合公司规定
- 审批权限控制：确保审批流程符合公司授权规定
- 付款安全控制：确保付款流程安全可靠`);
          }
          setActiveStep(3)
          setActiveStep(4)
        })
        .catch(error => {
          console.error('Error fetching data:', error);
          // 出错时使用默认数据
          setTypeCount({input: 0, output: 0});
          const defaultNodes = formatDataFromBackend(null);
          setFlowData(defaultNodes);
          setDataSource([]);
          // 默认内控手册内容
          setMarkdown(`# 采购报销流程内控手册

## 1. 流程概述

本流程描述了从申请人提交申请到财务付款的完整采购报销流程，涵盖了部门负责人审核、财务部门初审、财务负责人复审、领导终审等环节。

## 2. 流程节点说明

- **申请人提交申请**：申请人填写报销申请，提交相关凭证
- **部门负责人审核**：部门负责人审核申请的真实性和合理性
- **财务部门初审**：财务部门审核申请的合规性和票据的有效性
- **财务负责人复审**：财务负责人对初审通过的申请进行复审
- **领导终审**：公司领导对金额较大或特殊的报销申请进行最终审批
- **财务付款**：财务部门根据审批结果进行付款

## 3. 责任分工

| 流程节点 | 责任部门/人 |
|---------|------------|
| 申请人提交申请 | 申请人 |
| 部门负责人审核 | 部门负责人 |
| 财务部门初审 | 财务部门 |
| 财务负责人复审 | 财务负责人 |
| 领导终审 | 公司领导 |
| 财务付款 | 财务部门 |

## 4. 输入输出物

### 输入物
- 报销申请表
- 发票等原始凭证
- 采购合同（如需）

### 输出物
- 审批通过的报销申请
- 付款凭证
- 财务记账凭证

## 5. 风险控制点

- 票据真实性审核：确保发票等凭证真实有效
- 金额合理性审核：确保报销金额符合公司规定
- 审批权限控制：确保审批流程符合公司授权规定
- 付款安全控制：确保付款流程安全可靠`);
          setActiveStep(3)
          setActiveStep(4)
        });
    }
  }, [uploadUrl]);

  // 当flowData更新时，转换为React Flow格式
  useEffect(() => {
    if (flowData) {
      // 转换节点
      const reactFlowNodes = flowData?.nodes?.map(node => {
        let color = '#1890ff'; // 默认颜色
        let borderRadius = '4px';
        
        switch (node.type) {
          case 'start':
            color = '#52c41a';
            borderRadius = '50%';
            break;
          case 'process':
            color = '#1890ff';
            break;
          case 'decision':
            color = '#331e0866';
            break;
          case 'end':
            color = '#f5222d';
            borderRadius = '50%';
            break;
        }
        
        return {
          id: node.id.toString(),
          position: node.position,
          data: {
            label: (
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{node.name}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{node.assignee}</div>
              </div>
            )
          },
          style: {
            backgroundColor: color,
            color: '#fff',
            borderRadius: borderRadius,
            minWidth: '150px',
            padding: '8px'
          },
          type: 'default'
        };
      });
      
      // 转换边
      const reactFlowEdges = flowData?.edges?.map((edge, index) => ({
        id: index.toString(),
        source: edge.from.toString(),
        target: edge.to.toString(),
        style: {
          stroke: '#999'
        },
        type: 'default'
      }));
      
      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    }
  }, [flowData, setNodes, setEdges]);

  // 处理文件上传
  const handleUpload = (file) => {
    const newFile = {
      ...file,
      uid: file.uid || Date.now(),
      name: file.name,
      status: 'done'
    };
    setFileList([newFile]);
    // 上传文件到后端    上传后进入AI识别步骤
    // ===== //
    const formData = new FormData();
    formData.append('file', file);
    fetch('https://www.countmeout.top:3001/api/upload/file', {
      method: 'POST',
      headers: {
      },
      body: formData
    }).then(res => res.json()).then(data => {
      setUploadUrl(data.data[0]?.url || '');
      message.success('文件上传成功');
      setActiveStep(2);
    })
    // === mock ===
    // setUploadUrl("test1");
    // setActiveStep(2);
    return false; // 阻止自动上传
  };

  // 处理文件移除
  const handleRemove = (file) => {
    setFileList(fileList.filter(item => item.uid !== file.uid));
    message.success('文件已移除');
  };

  useEffect(() => {
    if (fileList.length === 0) {
      setActiveStep(0);
      setUploadUrl("")
      setDataSource([])
      setMarkdown("")
      setTypeCount({input: 0, output: 0})
      setFlowData([])
    }
  }, [fileList]);

  // 处理导出流程图
  const handleExportFlowChart = async () => {
  const originalFlow = document.querySelector('.react-flow');
  if (!originalFlow) return;

  try {
    // ==============================================
    // 1. 克隆一份流程图（用户看不见，离线处理）
    // ==============================================
    const cloneFlow = originalFlow.cloneNode(true);
    cloneFlow.style.position = 'absolute';
    cloneFlow.style.left = '-9999px';     // 移出屏幕
    cloneFlow.style.top = '0';
    cloneFlow.style.zIndex = '-1';        // 不干扰页面
    cloneFlow.style.background = '#fff';   // 白底

    // 加到 body 里（但看不见）
    document.body.appendChild(cloneFlow);
    // ==============================================
    // 2. 只修改克隆节点！原图不动
    // ==============================================
    const cloneViewport = cloneFlow.querySelector('.react-flow__viewport');
    const cloneSvg = cloneFlow.querySelector('svg');

    if (cloneViewport) {
      cloneViewport.style.transform = 'translate(0px, 0px) scale(1)';
      cloneViewport.style.overflow = 'visible';
    }
    if (cloneSvg) {
      cloneSvg.style.overflow = 'visible'; // 关键：显示所有线条
    }

    // 等DOM渲染
    await new Promise(r => setTimeout(r, 50));

        // ==============================================
    // 3. 对克隆节点截图
    // ==============================================
    const canvas = await html2canvas(cloneFlow, {
      scale: 2.5,            // 高清
      useCORS: true,
      backgroundColor: '#fff',
      logging: false,
      ignoreElements: (el) => {
        // 过滤控件
        return el.classList.contains('react-flow__controls') 
            || el.classList.contains('react-flow__minimap');
      }
    });

    // ==============================================
    // 4. 下载图片
    // ==============================================
    const link = document.createElement('a');
    link.download = `流程图-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    message.success('流程图导出成功！')}
    catch (error) {
      message.error('导出流程图失败' + error);
    } finally {
    // ==============================================
    // 5. 清理克隆节点（不污染页面）
    // ==============================================
    const cloneFlow = document.querySelector('.react-flow[style*="absolute"]');
      if (cloneFlow) {
        document.body.removeChild(cloneFlow);
      }
    }
  };

  // 处理导出手册
  const handleExportManual = async () => {
    const pdfContainer = document.getElementById('pdf-container');
    if (!pdfContainer) {
      message.error('请先生成内控手册');
      return;
    }
      // 1. 将HTML转成图片
  const canvas = await html2canvas(pdfContainer, {
    scale: 2, // 清晰度，越高越清晰
    useCORS: true, // 解决跨域图片问题
  });
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = 210; // A4宽度
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 2. 生成PDF
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    doc.save('内控手册导.pdf').then(() => {
      message.success('内控手册导出成功！');
    })  
    // 这里可以添加实际的导出逻辑
  };

  // 定义步骤配置
  const steps = [
    { title: '上传文件' },
    { title: 'AI识别', loading: true },
    { title: '生成结果' }
  ];

  return (
    <div className={styles.container}>
      <TitleWithDescription 
        title="内控流程图/手册自动生成" 
        description="上传修订后的制度文件，AI自动识别流程节点、责任人、输入输出物，生成流程图和内控手册" 
      />
      
      <div style={{ margin: '40px 0' }}>
        <StepsIndicator activeStep={activeStep} steps={steps} />
      </div>
      {
        activeStep === 2 && 
        (
                <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',flexDirection: 'column' }}>
          <LoadingOutlined style={{ fontSize:68 ,color: 'oklch(62.3% .214 259.815)' }} />
          <p>当前调用人数过多，请耐心等待...</p>
        </div>
      </Card>
        )
      }

      <div className={styles.mainLayout}>
        <div className={activeStep < 3 ? styles.leftSectionInitial : styles.leftSection}>
          <div className={styles.uploadSection}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.stepNumber}>1</span>
              上传制度文件
            </h3>
            
            <div className={styles.uploadArea}>
              <Upload
                multiple={false}
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={handleRemove}
                className={styles.uploadComponent}
              >
                <Button 
                  icon={<UploadOutlined />} 
                  style={{ 
                    width: '100%',
                    transition: 'all 0.3s ease'
                  }}
                  hoverStyle={{ transform: 'scale(1.02)' }}
                >
                  点击或拖拽上传
                </Button>
              </Upload>
              <p className={styles.uploadHint}>上传后自动开始识别</p>
              <p className={styles.uploadHintMargin}>支持 PDF, DOC, DOCX</p>
            </div>
            
            {fileList.length > 0 && (
              <div className={styles.fileList}>
                <h4 className={styles.fileListTitle}>已上传 ({fileList.length})</h4>
                {fileList.map((file) => (
                  <div key={file.uid} className={styles.fileItem}>
                    <div className={styles.fileInfo}>
                      <div>📄</div>
                      <div>
                        <p className={styles.fileName}>{file.name}</p>
                      </div>
                    </div>
                    <button 
                      className={styles.removeButton} 
                      onClick={() => handleRemove(file)}
                      style={{ 
                        transition: 'all 0.3s ease',
                        transform: 'scale(1)'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {activeStep >= 3 && flowData && (
            <div className={styles.resultSection}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.successIcon}>✓</span>
                识别结果
              </h3>
              
              <div className={styles.resultGrid}>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>流程节点数</p>
                  <p className={styles.resultValue}>{flowData.nodes.length}个</p>
                </div>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>责任部门</p>
                  <p className={styles.resultValue}>{new Set(flowData.nodes.map(node => node.assignee)).size}个</p>
                </div>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>决策节点</p>
                  <p className={styles.resultValue}>{flowData.nodes.filter(node => node.type === 'decision').length}个</p>
                </div>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>输入物类型</p>
                  <p className={styles.resultValue}>{typeCount.input}种</p>
                </div>
                <div className={styles.resultItemFull}>
                  <p className={styles.resultLabel}>输出物类型</p>
                  <p className={styles.resultValue}>{typeCount.output}种</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className={activeStep < 3 ? styles.rightSectionInitial : styles.rightSection}>
          {activeStep === 1 && (
            <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed #e8e8e8', borderRadius: '8px', backgroundColor: '#fafafa', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div className={styles.largeIcon}>📊</div>
              <p style={{ fontSize: '16px', color: '#999' }}>请上传制度文件开始流程识别</p>
            </div>
          )}
          
          {activeStep === 2 && (
            <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed #e8e8e8', borderRadius: '8px', backgroundColor: '#fafafa', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div className={styles.largeIcon} style={{ animation: 'spin 2s linear infinite' }}>🔄</div>
              <p style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>AI正在识别流程节点...</p>
              <p style={{ fontSize: '14px', color: '#999' }}>请稍候，正在分析制度文件内容</p>
            </div>
          )}
          
          {activeStep >= 3 && flowData && (
            <>
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <div className={styles.flowchartHeader}>
                  <h3 className={styles.flowchartTitle}>
                    <span>📊</span>
                    流程图
                  </h3>
                  <button 
                    className={styles.exportButton} 
                    onClick={handleExportFlowChart}
                    style={{ 
                      transition: 'all 0.3s ease',
                      transform: 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.backgroundColor = '#1890ff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.backgroundColor = '#666';
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1.05)'}
                  >
                    <span>📥</span>
                    导出流程图
                  </button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.flowchartHeader}>
                  <h3 className={styles.flowchartTitle}>
                    <span>📄</span>
                    内控手册
                  </h3>
                  <button 
                    className={styles.exportButton} 
                    onClick={handleExportManual}
                    style={{ 
                      transition: 'all 0.3s ease',
                      transform: 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.backgroundColor = '#1890ff';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.backgroundColor = '#666';
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1.05)'}
                  >
                    <span>📥</span>
                    导出手册
                  </button>
                </div>
              </div>
              </div>
              
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <div className={styles.flowchartContainer} style={{ position: 'relative' }}>
                    <div style={{ height: '500px', borderRadius: '8px', overflow: 'hidden' }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        style={{ width: '100%', height: '100%' }}
                      >
                        <Background variant="dots" gap={16} size={1} />
                        <Controls />
                      </ReactFlow>
                    </div>
                    
                    <div className={styles.legend}>
                      <p className={styles.legendTitle}>图例</p>
                      <div className={styles.legendItems}>
                        <div className={styles.legendItem}>
                          <div className={`${styles.legendColor} ${styles.legendColorStart}`}></div>
                          <span>开始</span>
                        </div>
                        <div className={styles.legendItem}>
                          <div className={`${styles.legendColor} ${styles.legendColorProcess}`}></div>
                          <span>处理</span>
                        </div>
                        <div className={styles.legendItem}>
                          <div className={`${styles.legendColor} ${styles.legendColorDecision}`}></div>
                          <span>决策</span>
                        </div>
                        <div className={styles.legendItem}>
                          <div className={`${styles.legendColor} ${styles.legendColorEnd}`}></div>
                          <span>结束</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div id="pdf-container" style={{ flex: 1 }}>
                  <div className={styles.flowchartContainer} style={{ position: 'relative' }}>
                    {/* <div style={{ padding: '24px', backgroundColor: '#fafafa', borderRadius: '8px', height: '500px', overflow: 'auto' }}>
                      <h4 style={{ margin: '0 0 24px 0', fontSize: '16px', fontWeight: '600' }}>内控手册内容</h4>
                      
                      <div style={{ marginBottom: '24px' }}>
                        <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>1. 流程概述</h5>
                        <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
                          本流程描述了从发起申请到归档存档的完整流程，涵盖了部门审核、风险评估、财务审批、总经理审批和执行实施等环节。
                        </p>
                      </div>
                      
                      <div style={{ marginBottom: '24px' }}>
                        <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>2. 流程节点说明</h5>
                        <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.5', color: '#333' }}>
                          <li style={{ marginBottom: '8px' }}><strong>发起申请</strong>：由申请人提交申请</li>
                          <li style={{ marginBottom: '8px' }}><strong>部门审核</strong>：部门主管进行审核</li>
                          <li style={{ marginBottom: '8px' }}><strong>风险评估</strong>：风险部门进行评估</li>
                          <li style={{ marginBottom: '8px' }}><strong>财务审批</strong>：财务总监进行审批</li>
                          <li style={{ marginBottom: '8px' }}><strong>总经理审批</strong>：总经理进行最终审批</li>
                          <li style={{ marginBottom: '8px' }}><strong>执行实施</strong>：执行部门负责实施</li>
                          <li><strong>归档存档</strong>：行政部负责归档</li>
                        </ul>
                      </div>
                      
                      <div style={{ marginBottom: '24px' }}>
                        <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>3. 责任分工</h5>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                              <th style={{ padding: '8px', border: '1px solid #e8e8e8', textAlign: 'left' }}>流程节点</th>
                              <th style={{ padding: '8px', border: '1px solid #e8e8e8', textAlign: 'left' }}>责任部门/人</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>发起申请</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>申请人</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>部门审核</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>部门主管</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>风险评估</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>风险部门</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>财务审批</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>财务总监</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>总经理审批</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>总经理</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>执行实施</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>执行部门</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>归档存档</td>
                              <td style={{ padding: '8px', border: '1px solid #e8e8e8' }}>行政部</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div> */}
                    <div style={{ padding: '24px', lineHeight: '1.6', fontSize: '14px', color: '#333', overflow: 'auto', maxHeight: '500px' }}>
                      <Markdown>
                        {`${markdown}`}
                      </Markdown>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
      <div >
        {
          activeStep >=3 && (
            <div className={styles.resultSection} style={{ marginTop: '24px' }}>
              <h3 className={styles.sectionTitle}>流程节点详情</h3>
              <div className={styles.resultContent}>
                <Table dataSource={dataSource}>
                  <Table.Column title="节点名称" dataIndex="nodeName" key="name" />
                  <Table.Column title="责任人" dataIndex="owner" key="owner" />
                  <Table.Column title="输入物" dataIndex="input" key="input" />
                  <Table.Column title="输出物" dataIndex="output" key="output" />
                </Table>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
};

export default FlowChart;