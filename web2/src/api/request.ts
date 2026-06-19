import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

const API_BASE = '/api'

const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      const code = (body as any).code
      if (code === 0) return body
      if (code === 401) {
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          localStorage.removeItem('token')
          window.location.href = '/login'
        }
      }
      const err: any = new Error((body as any).msg || '请求失败')
      err.code = code
      err.data = (body as any).data
      return Promise.reject(err)
    }
    return body
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
            localStorage.removeItem('token')
            window.location.href = '/login'
          }
          break
        case 403: console.error('没有权限访问该资源'); break
        case 404: console.error('请求的资源不存在'); break
        case 500: console.error('服务器内部错误'); break
        default: console.error(data?.msg || data?.message || '请求失败')
      }
      const msg = data?.msg || data?.message || '网络请求失败，请稍后重试'
      const err: any = new Error(msg)
      err.code = status
      return Promise.reject(err)
    } else {
      console.error('网络连接失败，请检查网络')
      const err: any = new Error('网络连接失败，请检查网络')
      err.code = 0
      return Promise.reject(err)
    }
  }
)

export default request
export { API_BASE }
