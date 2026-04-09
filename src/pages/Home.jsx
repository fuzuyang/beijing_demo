import { useNavigate } from 'react-router-dom';
import styles from '../styles/Home.module.css';

const Home = () => {
  const navigate = useNavigate();

  const handleCardClick = (path) => {
    navigate(path);
  };

  // 预加载页面组件
  const handleMouseEnter = (path) => {
    if (path === '/flow-chart') {
      import('./FlowChart');
    } else if (path === '/internal-draft') {
      import('./InternalDraft');
    } else if (path === '/compliance-review') {
      import('./ComplianceReview');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>欢迎使用企业文件管理系统</h1>
        <p className={styles.welcomeSubtitle}>智能化文档管理与生成平台，提升企业办公效率</p>
      </div>
      
      <div className={styles.featuresGrid}>
        <div 
          className={styles.featureCard} 
          onClick={() => handleCardClick('/internal-draft')}
          onMouseEnter={() => handleMouseEnter('/internal-draft')}
        >
          <div className={`${styles.cardIcon} ${styles.blue}`}>📄</div>
          <h3 className={styles.cardTitle}>内部行政文书起草</h3>
          <p className={styles.cardDescription}>根据上传的背景材料，结合模板自动生成案宗报告、诉讼方案请示等审批文件</p>
          <div className={styles.startBtn}>开始使用 →</div>
        </div>
        
        <div 
          className={styles.featureCard} 
          onClick={() => handleCardClick('/flow-chart')}
          onMouseEnter={() => handleMouseEnter('/flow-chart')}
        >
          <div className={`${styles.cardIcon} ${styles.green}`}>📊</div>
          <h3 className={styles.cardTitle}>内控流程图生成</h3>
          <p className={styles.cardDescription}>上传制度文件，AI智能识别流程节点、责任人和输入输出物，自动生成流程图</p>
          <div className={styles.startBtn}>开始使用 →</div>
        </div>
        
        <div 
          className={styles.featureCard} 
          onClick={() => handleCardClick('/compliance-review')}
          onMouseEnter={() => handleMouseEnter('/compliance-review')}
        >
          <div className={`${styles.cardIcon} ${styles.purple}`}>🔍</div>
          <h3 className={styles.cardTitle}>内部合规审查</h3>
          <p className={styles.cardDescription}>输入业务事项或上传请示文件，AI自动匹配内部制度要求，识别程序和文件缺漏</p>
          <div className={styles.startBtn}>开始使用 →</div>
        </div>
      </div>
      
      <div className={styles.systemFeatures}>
        <h2 className={styles.systemFeaturesTitle}>系统特点</h2>
        <div className={styles.featuresList}>
          <div className={styles.featureItem}>
            <h4 className={styles.featureItemTitle}>智能文档生成</h4>
            <p className={styles.featureItemDescription}>基于模板和上传材料自动生成标准化文档</p>
          </div>
          <div className={styles.featureItem}>
            <h4 className={styles.featureItemTitle}>模板管理</h4>
            <p className={styles.featureItemDescription}>灵活的文档模板配置和管理功能</p>
          </div>
          <div className={styles.featureItem}>
            <h4 className={styles.featureItemTitle}>多格式支持</h4>
            <p className={styles.featureItemDescription}>支持多种文档格式的上传和处理</p>
          </div>
          <div className={styles.featureItem}>
            <h4 className={styles.featureItemTitle}>安全可靠</h4>
            <p className={styles.featureItemDescription}>企业级安全保障，数据加密存储</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;