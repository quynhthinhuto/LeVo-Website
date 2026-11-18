# Đưa LeVo lên GitHub

Bộ mã nguồn LeVo 1.1.0 gồm giao diện, máy chủ, dữ liệu từ vựng và audio.

## Đưa code vào repository

1. Giải nén ZIP.
2. Tạo repository trên GitHub.
3. Đưa nội dung thư mục LeVo vào repository; không chỉ tải nguyên file ZIP lên.

Nếu dùng Git, thay URL ví dụ bằng URL repository của bạn:

```sh
git init
git add .
git commit -m "Initial LeVo app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/levo.git
git push -u origin main
```

.gitignore đã loại .env.local, dữ liệu lớp ở .local/, audio/ và các file xuất bản. Bộ audio vẫn có trong ZIP để chạy tại máy; khi clone từ GitHub, có thể chép thư mục audio từ ZIP vào thư mục dự án. Máy chủ cục bộ cũng có thể lấy file audio còn thiếu từ LeVo online.

## Chạy mã nguồn

Cài Node.js 24 trở lên. Trong thư mục dự án:

```sh
npm start
```

Mở http://127.0.0.1:4318. Có thể dùng Start LeVo.command trên Mac hoặc Start LeVo.cmd trên Windows. Không mở trực tiếp dist/index.html.

Nghe mẫu và ghi âm không cần API key. Để kiểm tra phát âm bằng AI, vào Speaking → Connect AI, nhập key tại trang cài đặt cục bộ rồi chọn Save and enable. Key được lưu trong .env.local và tự nạp khi khởi động lại. Khi bấm Check, audio được gửi đến OpenAI và API có thể phát sinh phí.

## Chạy online cho cả lớp

Lưu mã nguồn trên GitHub chưa tạo máy chủ cho Speaking và Classroom. Bản online cần backend, cơ sở dữ liệu và cấu hình API riêng. Mã triển khai hiện tại dùng Worker, D1, R2 và xác thực giáo viên do Sites cung cấp; xem README.md và .openai/hosting.json.

scripts/preview.mjs là máy chủ chạy riêng trên máy, có danh tính giáo viên thử cục bộ. Giữ giới hạn loopback của máy chủ này; không dùng nó để công khai dữ liệu lớp.

Mở Open LeVo online.html để dùng bản LeVo online hiện có trên nhiều thiết bị.

## Kiểm tra

Có bộ audio trong dự án, chạy:

```sh
npm test
```

Các bài kiểm tra tự động dùng dữ liệu tạm và phản hồi AI mô phỏng, không gọi API có phí hoặc ghi vào lớp online. Xem README.md để biết phạm vi kiểm tra.
