import http from 'http';
import https from 'https';
/** 根据请求 URL 协议返回对应 agent */
export declare function getAgentForUrl(url: string): http.Agent | https.Agent;
/** 暴露给外部（如 webBookService）使用 */
export declare const sharedHttpAgent: http.Agent;
export declare const sharedHttpsAgent: https.Agent;
//# sourceMappingURL=httpAgent.d.ts.map