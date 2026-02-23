import request from '@/utils/request';

export const search = data => request('get', '/music/search', data);

export const collectMusic = data => request('post', '/music/collectMusic', data);

export const collectList = data => request('get', '/music/collectList', data);

export const hot = data => request('get', '/music/hot', data);

export const removeCollect = data => request('post', '/music/removeCollect', data);

// ==================== 音乐账号授权 ====================
export const musicAuthSubmitCookie = data => request('post', '/music/auth/cookie', data);
export const musicAuthRevoke = data => request('post', '/music/auth/revoke', data);
export const musicAuthStatus = data => request('get', '/music/auth/status', data);
export const musicAuthQrKey = data => request('get', '/music/auth/qr/key', data);
export const musicAuthQrCreate = data => request('get', '/music/auth/qr/create', data);
export const musicAuthQrCheck = data => request('get', '/music/auth/qr/check', data);
