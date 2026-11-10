// Loading the optional gift catalogue calls the provider's Business-only URL-signing API.
// Live gift events already carry giftDetails; they do not require this catalogue.
export const TIKTOK_CONNECTION_OPTIONS = Object.freeze({
  enableExtendedGiftInfo: false,
  processInitialData: false,
});

export function explainTikTokConnectionError(error) {
  const message = String(error?.message || error);
  if (/Business plan/i.test(message)) {
    return 'Dịch vụ ký EulerStream từ chối yêu cầu vì giới hạn gói dịch vụ. Bản sửa đã tắt tải danh mục quà mở rộng; nếu vẫn lỗi, kiểm tra phiên bản đang chạy và quyền ký kết nối của EulerStream. ' + message;
  }
  return message;
}
