import React, { useState, useEffect, useMemo, useCallback, memo, Suspense, lazy } from 'react';
import StepsIndicator from '../components/StepsIndicator';
import TitleWithDescription from '../components/TitleWithDescription';
import styles from '../styles/FlowChart.module.css';
import { Upload, Button, message, Table, Card, Spin } from 'antd';
import { UploadOutlined, LoadingOutlined } from '@ant-design/icons';
import { ReactFlow, ReactFlowProvider, Background, Controls, useNodesState, useEdgesState, Handle, Position } from 'reactflow';
// import Markdown from 'react-markdown'; // 改为懒加载
import 'reactflow/dist/style.css';

const Markdown = lazy(() => import('react-markdown'));

// 提取静态配置
const STEPS_CONFIG = [
  { title: '上传文件' },
  { title: 'AI识别', loading: true },
  { title: '生成结果' }
];

// 自定义节点组件，使用 memo 减少重渲染
const CustomNode = memo(({ data }) => {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '8px',
      backgroundColor: data.color || '#1890ff',
      color: '#fff',
      borderRadius: data.borderRadius || '4px',
      minWidth: '150px',
      border: 'none'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{data.label}</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>{data.assignee}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
});

const nodeTypes = {
  custom: CustomNode,
};

// 提取节点转换逻辑为纯函数
const getReactFlowElements = (flowData) => {
  if (!flowData || !flowData.nodes) return { nodes: [], edges: [] };

  const nodes = flowData.nodes.map(node => {
    let color = '#1890ff';
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
      default:
        break;
    }

    return {
      id: node.id.toString(),
      position: node.position,
      data: {
        label: node.name,
        assignee: node.assignee,
        color: color,
        borderRadius: borderRadius
      },
      type: 'custom'
    };
  });

  const edges = (flowData.edges || []).map((edge, index) => ({
    id: `e-${index}`,
    source: edge.from.toString(),
    target: edge.to.toString(),
    style: { stroke: '#999' },
    type: 'default',
    animated: edge.type === 'process'
  }));

  return { nodes, edges };
};

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

// 详情表格列定义
const TABLE_COLUMNS = [
  { title: '节点名称', dataIndex: 'nodeName', key: 'nodeName' },
  { title: '责任人', dataIndex: 'assignee', key: 'assignee' },
  { title: '输入物', dataIndex: 'input', key: 'input' },
  { title: '输出物', dataIndex: 'output', key: 'output' },
];

// 结果概览组件
const ResultSummary = memo(({ flowData, typeCount }) => (
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
));

// 流程图显示区域组件
const FlowChartDisplay = memo(({ nodes, edges, onNodesChange, onEdgesChange }) => (
  <div className={styles.flowchartContainer} style={{ position: 'relative' }}>
    <div style={{ height: '500px', borderRadius: '8px', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          onlyRenderVisibleElements={true}
          translateExtent={[[-1000, -1000], [2000, 2000]]}
          style={{ width: '100%', height: '100%' }}
        >
          <Background variant="dots" gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
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
));

// 内控手册显示区域组件
const ManualDisplay = memo(({ markdown }) => (
  <div className={styles.flowchartContainer} style={{ position: 'relative' }}>
    <div style={{ padding: '24px', lineHeight: '1.6', fontSize: '14px', color: '#333', overflow: 'auto', maxHeight: '500px' }}>
      <Suspense fallback={<Spin size="small" description="手册渲染中..." />}>
        <Markdown>
          {`${markdown}`}
        </Markdown>
      </Suspense>
    </div>
  </div>
));

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

  // 处理文件移除
  const handleRemove = useCallback((file) => {
    setFileList(prev => prev.filter(f => f.uid !== file.uid));
    setUploadUrl('');
    setFlowData(null);
    setActiveStep(1);
  }, []);



  // 模拟步骤流程 (已注释)
  
  useEffect(() => {
    if (!uploadUrl) return;

    const controller = new AbortController();
    
    // 调用后端接口获取流程图数据
    fetch(`https://www.countmeout.top:3001/api/mock/generateFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { file: uploadUrl } }),
      signal: controller.signal
    })
      .then(res => res.json())
      .then(data => {
        if (!data || !data.data) throw new Error('No data received');
        
        setTypeCount({
          input: data.data.inputTypeCount || 0,
          output: data.data.outputTypeCount || 0
        });
        
        const chartNodes = formatDataFromBackend(data.data);
        setFlowData(chartNodes);
        setDataSource(data.data.chartNodeInfo || []);
        setMarkdown(data.data.doc || `# 默认内控手册内容...`); // 此处省略长文本以节省空间
        
        setActiveStep(3); // 直接跳到步骤3，避免多次更新
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        console.error('Error fetching data:', error);
        message.error('获取流程数据失败');
        
        // 使用回退逻辑
        setFlowData(formatDataFromBackend(null));
        setActiveStep(3);
      });

    return () => controller.abort();
  }, [uploadUrl]);

  // 使用 useMemo 转换 React Flow 元素，避免每次重渲染都重新计算
  const { nodes: memoizedNodes, edges: memoizedEdges } = useMemo(
    () => getReactFlowElements(flowData),
    [flowData]
  );

  useEffect(() => {
    if (memoizedNodes.length > 0) {
      setNodes(memoizedNodes);
      setEdges(memoizedEdges);
    }
  }, [memoizedNodes, memoizedEdges, setNodes, setEdges]);

  // 处理文件上传
  const handleUpload = useCallback((file) => {
    const newFile = {
      uid: file.uid || Date.now().toString(),
      name: file.name,
      status: 'done'
    };
    setFileList([newFile]);
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('https://www.countmeout.top:3001/api/upload/file', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      setUploadUrl(data.data[0]?.url || '');
      message.success('文件上传成功');
      setActiveStep(2);
    })
    .catch(() => message.error('文件上传失败'));
    
    return false;
  }, []);

  // 动态导入重型库以优化导出性能
  const handleExportFlowChart = async () => {
    const originalFlow = document.querySelector('.react-flow');
    if (!originalFlow) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(originalFlow, {
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        scale: 2, // 提高导出清晰度
      });
      
      const link = document.createElement('a');
      link.download = `内控流程图_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      message.success('流程图导出成功');
    } catch (e) { 
      console.error(e);
      message.error('流程图导出失败');
    }
  };

  const handleExportManual = async () => {
    const container = document.getElementById('pdf-container');
    if (!container) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`内控手册_${new Date().getTime()}.pdf`);
      message.success('内控手册导出成功');
    } catch (e) { 
      console.error(e);
      message.error('内控手册导出失败');
    }
  };

  return (
    <div className={styles.container}>
      <TitleWithDescription 
        title="内控流程图/手册自动生成" 
        description="上传修订后的制度文件，AI自动识别流程节点、责任人、输入输出物，生成流程图和内控手册" 
      />
      
      <div style={{ margin: '40px 0' }}>
        <StepsIndicator activeStep={activeStep} steps={STEPS_CONFIG} />
      </div>
      {
        activeStep === 2 && 
        (
                <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',flexDirection: 'column', padding: '24px' }}>
          <LoadingOutlined style={{ fontSize:68 ,color: 'oklch(62.3% .214 259.815)', marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', color: '#333', fontWeight: '500' }}>AI正在识别流程节点...</p>
          <p style={{ fontSize: '14px', color: '#999' }}>当前调用人数过多，请耐心等待，正在分析制度文件内容</p>
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
                <ResultSummary flowData={flowData} typeCount={typeCount} />
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
              <p style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>AI正在处理中...</p>
              <p style={{ fontSize: '14px', color: '#999' }}>请稍候，正在生成最终结果</p>
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
                    <FlowChartDisplay 
                      nodes={nodes} 
                      edges={edges} 
                      onNodesChange={onNodesChange} 
                      onEdgesChange={onEdgesChange} 
                    />
                  </div>
                  
                  <div id="pdf-container" style={{ flex: 1 }}>
                    <ManualDisplay markdown={markdown} />
                  </div>
                </div>
            </>
          )}
        </div>

      </div>
      <div >
        {activeStep >= 3 && (
          <div className={styles.resultSection} style={{ marginTop: '24px' }}>
            <h3 className={styles.sectionTitle}>流程节点详情</h3>
            <div className={styles.resultContent}>
              <Table 
                dataSource={dataSource} 
                columns={TABLE_COLUMNS} 
                rowKey={(record, index) => index}
                pagination={{ pageSize: 5 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowChart;