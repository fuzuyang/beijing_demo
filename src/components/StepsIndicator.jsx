import React from 'react';
import { Steps, Spin } from 'antd';

const { Step } = Steps;

const StepsIndicator = React.memo(({ activeStep, steps = [] }) => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Steps 
        current={activeStep - 1} 
        orientation="horizontal" 
        size="small"
        style={{ justifyContent: 'center' }}
        items={steps.map((step, index) => ({
          title: step.title,
          icon: activeStep === index + 1 && step.loading ? <Spin size="small" /> : undefined
        }))}
      />
    </div>
  );
});

export default StepsIndicator;