import React, { useState, useEffect } from 'react';
import StepsIndicator from '../components/StepsIndicator';
import TitleWithDescription from '../components/TitleWithDescription';
import styles from '../styles/FlowChart.module.css';
import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

const FlowChart = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [flowData, setFlowData] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 模拟步骤流程
  useEffect(() => {
    let timer;
    
    if (activeStep === 1) {
      // 等待用户上传文件
    } else if (activeStep === 2) {
      // 模拟AI识别过程
      timer = setTimeout(() => {
        setActiveStep(3);
        // 模拟从后端获取流程图数据
        setFlowData({
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
        });
      }, 4000);
    }
    
    return () => clearTimeout(timer);
  }, [activeStep]);

  // 当flowData更新时，转换为React Flow格式
  useEffect(() => {
    if (flowData) {
      // 转换节点
      const reactFlowNodes = flowData.nodes.map(node => {
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
      const reactFlowEdges = flowData.edges.map((edge, index) => ({
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
    setFileList([...fileList, newFile]);
    message.success('文件上传成功');
    // 上传后进入AI识别步骤
    setActiveStep(2);
    return false; // 阻止自动上传
  };

  // 处理文件移除
  const handleRemove = (file) => {
    setFileList(fileList.filter(item => item.uid !== file.uid));
    message.success('文件已移除');
  };

  // 处理导出流程图
  const handleExportFlowChart = () => {
    message.success('流程图导出成功！');
    // 这里可以添加实际的导出逻辑
  };

  // 处理导出手册
  const handleExportManual = () => {
    message.success('内控手册导出成功！');
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
      
      <div className={styles.mainLayout}>
        <div className={activeStep < 3 ? styles.leftSectionInitial : styles.leftSection}>
          <div className={styles.uploadSection}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.stepNumber}>1</span>
              上传制度文件
            </h3>
            
            <div className={styles.uploadArea}>
              <Upload
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
                  <p className={styles.resultValue}>8种</p>
                </div>
                <div className={styles.resultItemFull}>
                  <p className={styles.resultLabel}>输出物类型</p>
                  <p className={styles.resultValue}>8种</p>
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
                
                <div style={{ flex: 1 }}>
                  <div className={styles.flowchartContainer} style={{ position: 'relative' }}>
                    <div style={{ padding: '24px', backgroundColor: '#fafafa', borderRadius: '8px', height: '500px', overflow: 'auto' }}>
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
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlowChart;