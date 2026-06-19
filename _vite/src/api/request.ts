// Re-export the shared axios instance from index.ts
// This file exists because some modules import from './request' directly
import axios, { type AxiosInstance } from 'axios'

const API_BASE = '/api'

const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      const msg = data?.msg || data?.message || '网络请求失败，请稍后重试'
      const err: any = new Error(msg)
      err.code = status
      return Promise.reject(err)
    } else {
      const err: any = new Error('网络连接失败，请检查网络')
      err.code = 0
      return Promise.reject(err)
    }
  }
)

export default request
