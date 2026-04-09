import request from "./request";

// 合规审查API
export const complianceApi = {
  // 内部合规审查
  complianceReview: (data) =>
    request("/v1/risk/evaluate", {
      method: "POST",
      data,
    }),

  // 文档上传与模板生成
  uploadDocument: (formData) =>
    request("/api_beijing/upload/document", {
      method: "POST",
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
};

export default complianceApi;
