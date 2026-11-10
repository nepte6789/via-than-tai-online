# Vía Thần Tài Online

Không gian Vía Thần Tài Online 2.5D cho TikTok LIVE. Người xem tương tác trên sân tài lộc; người tặng quà được xướng tên cùng lời chúc may mắn, bình an và hanh thông bằng giọng đọc tiếng Việt. Nhạc hòa tấu tài lộc vui tươi, hiệu ứng quà tặng và lời chúc tiếng Việt.

Mã nguồn chia sẻ miễn phí (MIT). Có hai phần:

| Thư mục | Là gì |
|---|---|
| `index.html`, `assets/` | Bản web tĩnh cho mọi người tự vào tham gia (đăng lên Cloudflare Pages) |
| `live/` | Bộ công cụ phát LIVE: server Node, overlay 9:16, bảng điều khiển |

## Chạy bộ LIVE trên máy phát

Cần Node.js 20 trở lên.

```bash
cd live
npm install
npm start
```

1. Mở `http://localhost:3000/live/control.html` (bảng điều khiển).
2. Bấm **Mở màn hình overlay 9:16**, rồi bấm **Bật âm thanh** một lần trong cửa sổ đó (trình duyệt chặn tự phát tiếng).
3. Trong TikTok LIVE Studio: *Add source → Window capture* → chọn cửa sổ overlay. Với OBS thì dùng *Browser source* trỏ tới `http://localhost:3000/live/overlay.html`, kích thước 1080×1920.
4. Bật LIVE trên TikTok, nhập `@username` vào bảng điều khiển, bấm **Kết nối**.

Chưa live vẫn thử được: dùng **Thử tương tác**, **Đổ người mẫu 15/36/64/100** hoặc **Bot mô phỏng**.

### Người xem làm được gì

- **Bình luận bất kỳ**: được vào ngồi (tối đa 100 chỗ, chỗ ngồi tự mở rộng 24 → 36 → 64 → 100). Đầy chỗ thì người im lặng lâu nhất mà chưa tặng quà sẽ nhường chỗ.
- **Bình luận đúng từ khóa** `nam`, `nữ`, `bà`, `ông`, `bé trai`, `bé gái`: đổi nhân vật với áo dài, khăn đóng và trang phục lễ hội. Hỗ trợ cả từ khóa không dấu; các câu bình luận dài không bị nhận nhầm.
- **Bình luận `xin quẻ`**: nhận một trong tám quẻ tài lộc, gồm câu thơ, lời chúc và lời nhắc thực tế. Mỗi khách xin lại sau 15 giây. Quẻ mang ý nghĩa văn hóa, giải trí.
- **Tặng quà**: banner xướng tên, giọng đọc lời chúc (lấy lời chúc từ bình luận gần nhất của người đó nếu có), hiệu ứng theo giá trị quà, cộng điểm vào Bảng Tài Lộc.
- **Thả tim**: tim bay trên đầu nhân vật.

## Bảo mật

Dự án được viết để ai tải về chạy cũng an toàn mặc định:

- **Không dùng tài khoản TikTok.** Server chỉ đọc sự kiện công khai của phòng live theo username. Không cần, không hỏi và không lưu mật khẩu, cookie hay session. Không gửi tin nhắn thay bạn.
- **Chỉ mở trên máy mình.** Server lắng nghe `127.0.0.1`, máy khác trong mạng hay Internet không truy cập được. Muốn mở ra ngoài phải tự đặt biến `HOST`. Không nên làm vậy khi chưa thêm đăng nhập.
- **Chặn trang web lạ điều khiển.** WebSocket chỉ nhận kết nối từ chính trang của server (kiểm tra `Origin`), và header `Host` phải là localhost (chống DNS rebinding). Một trang web khác đang mở trong cùng trình duyệt không gửi được lệnh. Cửa sổ overlay chỉ nhận dữ liệu, không gửi lệnh được.
- **File tĩnh có danh sách trắng.** Chỉ phục vụ `/assets` và `/live`. Chặn file ẩn (`.git`, `.env`), `node_modules`, mã server, `package.json` và mọi đường dẫn `../`.
- **Không tin dữ liệu vào.** Tên người xem, bình luận và tên quà đều bị cắt độ dài. Cài đặt chỉ nhận đúng khóa, đúng kiểu, trong giới hạn. Văn bản đưa vào giọng đọc được escape XML. Mọi chữ trên màn hình vẽ bằng `textContent` hoặc canvas, không chèn HTML, nên bình luận chứa mã độc chỉ hiện ra như chữ thường.
- **Chống spam.** Hàng đợi giọng đọc tối đa 15 câu. Bình luận thường không đọc thành tiếng.
- **Phụ thuộc ghim phiên bản** trong `live/package.json`: `ws`, `msedge-tts`, `tiktok-live-connector`. Không có khóa API nào trong mã.

Các lớp trên đã được thử: đường dẫn `../`, `%2e%2e`, `.git/config`, `server.mjs`, `package.json` đều trả 404. Host giả trả 421. WebSocket từ Origin lạ bị từ chối. Lệnh gửi từ overlay bị bỏ qua. Cài đặt sai kiểu bị kẹp về giới hạn.

### Lưu ý

- `tiktok-live-connector` là thư viện cộng đồng, không phải API chính thức của TikTok. Nó có thể ngừng chạy khi TikTok đổi hệ thống. Kiểm tra điều khoản TikTok trước khi dùng cho kênh của bạn.
- Giọng đọc dùng dịch vụ Read Aloud của Microsoft Edge qua mạng (giọng Nam Minh, Hoài My). Máy phát cần có Internet.
- Hình ảnh trong `assets/` được tạo bằng Google Flow, nhạc nền tạo bằng Gemini. Kiểm tra điều khoản của các dịch vụ đó trước khi dùng thương mại, hoặc thay bằng tài nguyên của bạn.

## Miễn trừ trách nhiệm

Dự án được chia sẻ **miễn phí, với mục đích học tập và tham khảo lập trình**. Phần mềm được cung cấp "nguyên trạng" (AS IS), không kèm bất kỳ bảo đảm nào, rõ ràng hay ngụ ý.

Khi tải về, sử dụng, chỉnh sửa hoặc phân phối lại mã nguồn này, **bạn tự chịu hoàn toàn trách nhiệm** về:

- Mọi nội dung bạn phát trên livestream hoặc đăng tải, bao gồm hình ảnh, âm thanh, giọng đọc, lời nguyện, bình luận được hiển thị.
- Việc nhận quà, donation hoặc bất kỳ khoản thu nào từ người xem.
- Việc tuân thủ điều khoản sử dụng của TikTok và các nền tảng, dịch vụ bên thứ ba khác (thư viện đọc sự kiện TikTok là thư viện cộng đồng, không chính thức).
- Việc tuân thủ pháp luật nơi bạn sinh sống và hoạt động, kể cả quy định về hoạt động tôn giáo, quảng cáo, thuế và bản quyền.
- Mọi rủi ro và thiệt hại phát sinh, trực tiếp hay gián tiếp, như bị khóa tài khoản, bị dừng live, mất dữ liệu, tranh chấp hay khiếu nại.

Tác giả **không liên quan, không bảo trợ và không chịu trách nhiệm** đối với bất kỳ kênh, tài khoản, sản phẩm hay hoạt động nào sử dụng mã nguồn này. Dự án không đại diện cho bất kỳ chùa, tu viện hay tổ chức tôn giáo nào. Khi dùng nội dung liên quan đến Phật giáo, xin giữ sự tôn kính và không dùng vào mục đích lừa đảo, trục lợi hay xúc phạm niềm tin của người khác.

Việc sử dụng mã nguồn đồng nghĩa với việc bạn đã đọc và đồng ý với các điều trên.

> **Disclaimer (EN):** This project is shared free of charge for educational purposes only and is provided "AS IS", without warranty of any kind. Anyone who uses, modifies or redistributes it is solely responsible for their own content, streams, donations, compliance with TikTok and other platforms' terms, and applicable laws. The author is not affiliated with, does not endorse, and accepts no liability for any channel, account, product or activity built with this code, nor for any direct or indirect damages.

Xin cảm ơn và chúc bạn thân tâm an lạc. Cung chúc phát tài, vạn sự hanh thông.

## Giấy phép

MIT, xem `LICENSE`.

### Giao diện Vía Thần Tài

Cảnh điện Thần Tài đỏ–vàng và các biểu tượng đồng vàng, thỏi vàng, túi lộc được vẽ bằng SVG trong `assets/`. Cả web tĩnh và overlay dùng chung bộ ảnh này. Quà trên web là mô phỏng, không có thanh toán. Các ảnh gốc được giữ để tương thích với nhân vật hiện có.

### Nhạc tài lộc và bot tự thay khách

- Bấm **Bật nhạc tài lộc** trên overlay để phát bản hòa tấu ngũ cung vui tươi, được tổng hợp tại trình duyệt trong `assets/prosperity-music.js`, không cần tải MP3. Nhạc tự giảm âm khi đọc lời chúc; công tắc Nhạc nền bật/tắt nhạc. Không còn ba vị sư cố định, chuông hay mõ.
- Trong bảng điều khiển, chọn **Đổi một khách mỗi (giây)** (15–3600, mặc định 90), số bot và nhịp tương tác rồi bật bot. Mỗi chu kỳ thay một khách mô phỏng, không thay khách TikTok thật. Tên bot không có hậu tố; bot xin lời chúc và nhận tối đa 3 điểm lộc mỗi khách.
- Bảng tài lộc tính độc lập với chỗ ngồi: giữ nguyên điểm khi bot đổi hoặc tắt, và khi tải lại overlay. Điểm giữ trong phiên server; khởi động lại server sẽ bắt đầu phiên mới. Quà TikTok thật giữ nguyên số điểm, không bị giới hạn như bot.

### Giao diện ngọc bích và đồng hồ Việt Nam

Overlay, web tĩnh và bảng điều khiển dùng chung bảng màu ngọc bích – đỏ son – vàng ấm trong `assets/prosperity-theme.css`. Sáu nhân vật SVG mới nằm trong `assets/characters/`, không dùng y phục tu hành. Đồng hồ trên overlay là giờ hiện tại ở `Asia/Ho_Chi_Minh` (UTC+7), không phải thời lượng live.

Bảng điều khiển có nút **Xin quẻ tài lộc** để thử tương tác; bản web tĩnh có nút cùng tên sau khi vào sảnh. Dữ liệu tám quẻ dùng chung trong `assets/fortunes.js`. Bảng điểm phiên và chức năng đổi bot vẫn hoạt động như trước.

### Bộ mỹ thuật đại điện đỏ–vàng

Toàn bộ tài nguyên đang hiển thị chuyển sang bộ ảnh 3D mới trong `assets/artwork/`: `hall-imperial.webp` (đại điện, Thần Tài, cột rồng, cây lộc và sân), `characters-festival.webp` (sáu nhân vật áo dài lễ hội), `props-festival.webp` (vàng, đồng tiền, túi lộc, cây tài lộc, hoa đào, lư hương). Ảnh nhân vật và vật phẩm có alpha trong suốt. `assets/festival-art.js` lấy đúng ô từ mỗi atlas khi vẽ, không tải các hình SVG/PNG cũ. WebP giữ gói ảnh khoảng 1,5 MB; bản gốc tạo ảnh được giữ trong môi trường làm việc.

Bảng thông tin, thông báo quà, quẻ và bảng điều khiển dùng nền đỏ son/đỏ rượu, đường viền vàng trong `assets/prosperity-theme.css`. Bộ font Playfair Display 700 và Nunito Sans 400/700 được lưu cục bộ dạng WOFF, đã kiểm tra ký tự tiếng Việt; kèm giấy phép SIL Open Font License trong `assets/fonts/`. Không cần gọi Google Fonts để hiển thị.

### Lỗi EulerStream yêu cầu Business plan

Nếu gặp `[fetchWebcastSignatureFromEulerRoute] ... Business plan`, cập nhật mã mới rồi khởi động lại server. Cấu hình `live/tiktok-config.mjs` tắt `enableExtendedGiftInfo`: danh mục quà mở rộng là tùy chọn và gọi API ký URL giới hạn Business. Sự kiện quà trực tiếp vẫn được đọc từ `giftDetails` (tên, loại, số kim cương) để xướng tên và tính điểm.

Việc này không loại bỏ bước ký WebSocket bắt buộc của thư viện. Nếu nhà cung cấp tiếp tục báo giới hạn/quyền truy cập khi ký kết nối, cần kiểm tra điều kiện dịch vụ EulerStream; bản sửa không cam kết kết nối miễn phí luôn hoạt động. Không cần cung cấp mật khẩu hay cookie TikTok.

Kiểm tra lỗi này bằng `cd live && node --test test/tiktok-config.test.mjs`.

### Dùng tài khoản EulerStream của bạn

Lấy API key trong Dashboard của EulerStream. Không dùng mật khẩu tài khoản, không gửi key trong bình luận/chat, không ghi vào HTML hoặc commit lên GitHub. Server đọc biến môi trường `EULERSTREAM_API_KEY` và truyền qua tùy chọn `signApiKey` của thư viện. Không có key thì giữ cấu hình kết nối cộng đồng như trước.

Trên Windows PowerShell, mở terminal trong thư mục `live` rồi chạy (thay giá trị mẫu bằng key của bạn ngay trên máy):

```powershell
$env:EULERSTREAM_API_KEY = "YOUR_API_KEY"
npm start
```

Trên macOS/Linux, mở terminal trong thư mục `live`:

```sh
read -r -s -p "EulerStream API key: " EULERSTREAM_API_KEY
export EULERSTREAM_API_KEY
npm start
```

Đặt biến môi trường trong hệ điều hành hoặc trình quản lý tiến trình nếu muốn giữ cấu hình sau khi đóng terminal. Sau khi đổi key, khởi động lại server rồi kết nối lại kênh. API key không được gửi xuống overlay/bảng điều khiển. Có tài khoản hoặc API key không đồng nghĩa mọi endpoint đều được phép: quyền ký và hạn mức phụ thuộc gói EulerStream. Danh mục quà mở rộng vẫn tắt để tránh gọi API URL-signing yêu cầu Business.
