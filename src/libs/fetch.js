import { isExt, isGm } from "./browser";
import { sendMsg } from "./msg";
import {
  MSG_FETCH,
  CACHE_NAME,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_OPENAI,
} from "../config";

/**
 * 油猴脚本的请求封装
 * @param {*} input
 * @param {*} init
 * @returns
 */
const fetchGM = async (input, { method = "GET", headers, body } = {}) =>
  new Promise((resolve, reject) => {
    try {
      window.GM_xmlhttpRequest({
        method,
        url: input,
        headers,
        data: body,
        onload: (response) => {
          if (response.status === 200) {
            const headers = new Headers();
            response.responseHeaders.split("\n").forEach((line) => {
              let [name, value] = line.split(":").map((item) => item.trim());
              if (name && value) {
                headers.append(name, value);
              }
            });
            resolve(new Response(response.response, { headers }));
          } else {
            reject(new Error(`[${response.status}] ${response.responseText}`));
          }
        },
        onerror: reject,
      });
    } catch (error) {
      reject(error);
    }
  });

/**
 * 构造缓存 request
 * @param {*} request
 * @returns
 */
const newCacheReq = async (request, translator) => {
  if (translator === OPT_TRANS_MICROSOFT) {
    request.headers.delete("Authorization");
  } else if (translator === OPT_TRANS_OPENAI) {
    request.headers.delete("Authorization");
    request.headers.delete("api-key");
  }

  if (request.method !== "GET") {
    const body = await request.text();
    const cacheUrl = new URL(request.url);
    cacheUrl.pathname += body;
    request = new Request(cacheUrl.toString(), { method: "GET" });
  }

  return request;
};

/**
 * 请求数据
 * @param {*} input
 * @param {*} init
 * @param {*} opts
 * @returns
 */
export const fetchData = async (input, init, { useCache, translator } = {}) => {
  const cacheReq = await newCacheReq(new Request(input, init), translator);
  const cache = await caches.open(CACHE_NAME);
  let res;

  // 查询缓存
  if (useCache) {
    try {
      res = await cache.match(cacheReq);
    } catch (err) {
      console.log("[cache match]", err);
    }
  }

  // 发送请求
  if (!res) {
    if (isGm) {
      res = await fetchGM(input, init);
    } else {
      res = await fetch(input, init);
    }
  }

  if (!res?.ok) {
    throw new Error(`response: ${res.statusText}`);
  }

  // 插入缓存
  if (useCache) {
    try {
      await cache.put(cacheReq, res.clone());
    } catch (err) {
      console.log("[cache put]", err);
    }
  }

  const contentType = res.headers.get("Content-Type");
  if (contentType?.includes("json")) {
    return await res.json();
  }
  return await res.text();
};

/**
 * fetch 兼容性封装
 * @param {*} input
 * @param {*} init
 * @param {*} opts
 * @returns
 */
export const fetchPolyfill = async (input, init, opts) => {
  // 插件
  if (isExt) {
    const res = await sendMsg(MSG_FETCH, { input, init, opts });
    if (res.error) {
      throw new Error(res.error);
    }
    return res.data;
  }

  // 油猴/网页
  return await fetchData(input, init, opts);
};
