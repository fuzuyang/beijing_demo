import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout, Menu, Spin } from 'antd';
import { HomeOutlined, FileTextOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './styles/App.scss';

const Home = lazy(() => import('./pages/Home'));
const InternalDraft = lazy(() => import('./pages/InternalDraft'));
const FlowChart = lazy(() => import('./pages/FlowChart'));
const ComplianceReview = lazy(() => import('./pages/ComplianceReview'));

const { Sider, Content } = Layout;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const getSelectedKey = () => {
    const path = location.pathname;
    const pathKeyMap = {
      '/': '1',
      '/internal-draft': '2',
      '/flow-chart': '3',
      '/compliance-review': '4'
    };
    return pathKeyMap[path] || '1';
  };

  const handleMenuClick = (e) => {
    const pathMap = {
      '1': '/',
      '2': '/internal-draft',
      '3': '/flow-chart',
      '4': '/compliance-review'
    };
    navigate(pathMap[e.key]);
  };

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Sider width={200} className="sider">
        <div className="logo">
          <h1>企业文件管理系统</h1>
          <p>Document Management</p>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={[
            { key: '1', icon: <HomeOutlined />, label: '首页' },
            { key: '2', icon: <FileTextOutlined />, label: '内部行政文书起草' },
            { key: '3', icon: <BarChartOutlined />, label: '内控流程图生成' },
            { key: '4', icon: <CheckCircleOutlined />, label: '内部合规审查' },
          ]}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ flex: 1, width: '100%' }}>
        <Content className="content">
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/internal-draft" element={<InternalDraft />} />
              <Route path="/flow-chart" element={<FlowChart />} />
              <Route path="/compliance-review" element={<ComplianceReview />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
