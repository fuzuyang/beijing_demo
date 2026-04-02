import React from 'react';

const TitleWithDescription = ({ title, description }) => {
  return (
    <div style={{
      marginBottom: '40px',
      width: '100%'
    }}>
      <h2 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '18px', 
        fontWeight: '600', 
        lineHeight: '24px'
      }}>
        {title}
      </h2>
      <p style={{ 
        margin: '0', 
        color: '#666', 
        fontSize: '14px',
        lineHeight: '1.4'
      }}>
        {description}
      </p>
    </div>
  );
};

export default TitleWithDescription;