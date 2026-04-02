import axios from "axios";

const API_BASE_URL = "/api";

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1000000, // 超时时间设置为100秒，适应后端API的响应时间
});

// 请求拦截器
service.interceptors.request.use(
  // 正常请求被拦截下来的回调函数
  (config) => {
    // 从本地存储中获取 token
    const token = localStorage.getItem("userToken");
    if (token) {
      // 说明本地有 token 信息，在请求头的 Authorization 字段统一添加 token
      config.headers["Authorization"] = "Bearer " + token;
    }
    // 放行请求
    return config;
  },
  // 发生错误时的回调函数
  (error) => {
    console.log("请求拦截出错：", error);
    // 返回被拒绝的Promise，使前端的try-catch能够捕获到错误
    return Promise.reject(error);
  },
);

// 响应拦截器
service.interceptors.response.use(
  // 正常响应被拦截下来时的回调函数
  (response) => {
    const res = response.data;
    // 放行响应
    return res;
  },
  // 发生错误时的回调函数
  (error) => {
    console.log("响应拦截出错：", error);
    // 返回被拒绝的Promise，使前端的try-catch能够捕获到错误
    return Promise.reject(error);
  },
);

// 统一请求方法
const request = (url, options) => {
  return service({
    url,
    ...options,
  });
};

export default request;
