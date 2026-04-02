import request from "./request";

// 具体业务API
export const documentApi = {
  // 内部行政文书起草
  createDraft: (data) =>
    request("/documents/draft", {
      method: "POST",
      data,
    }),

  // 内控流程图生成
  generateFlowChart: (data) =>
    request("/documents/flow-chart", {
      method: "POST",
      data,
    }),

  // 内部合规审查
  complianceReview: (data) =>
    request("/v1/risk/evaluate", {
      method: "POST",
      data,
    }),

  // 获取文档列表
  getDocuments: (params) =>
    request("/documents", {
      method: "GET",
      params,
    }),

  // 获取文档详情
  getDocumentDetail: (id) =>
    request(`/documents/${id}`, {
      method: "GET",
    }),
};

export default documentApi;
