# Hướng dẫn sử dụng Cache cho chức năng Quét Mã Hiệu & Tìm Kiếm

## Tổng quan

Để tăng tốc độ tìm kiếm khi người dùng quét mã hiệu hoặc tìm kiếm thí sinh, hệ thống đã được tích hợp **cache với TTL (Time To Live)**. Dữ liệu từ Google Sheets sẽ được lưu vào bộ nhớ đệm để giảm thiểu số lần gọi API đến Google Sheets.

## Cách hoạt động

### 1. Cache tự động
- Khi người dùng thực hiện tìm kiếm lần đầu tiên cho một ngày thi cụ thể, dữ liệu sẽ được đọc từ Google Sheets và lưu vào cache
- Các lần tìm kiếm tiếp theo (trong vòng 5 phút) sẽ sử dụng dữ liệu từ cache thay vì gọi lại Google Sheets
- Cache được tự động dọn dẹp mỗi 10 phút để giải phóng bộ nhớ

### 2. Thời gian sống (TTL)
- **Mặc định**: 5 phút
- Sau 5 phút, cache sẽ hết hạn và dữ liệu mới sẽ được đọc từ Google Sheets
- Bạn có thể điều chỉnh TTL trong file `/lib/cache.ts`

### 3. Xóa cache thủ công

#### Xóa toàn bộ cache:
```bash
curl -X POST http://localhost:3000/api/scanner/cache
```

#### Xóa cache cho một ngày cụ thể:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"date": "01-01-2024"}' \
  http://localhost:3000/api/scanner/cache
```

#### Kiểm tra trạng thái cache:
```bash
curl http://localhost:3000/api/scanner/cache
```

## Lợi ích

1. **Tăng tốc độ tìm kiếm**: Giảm từ 3-5 giây xuống còn < 100ms cho các lần tìm kiếm sau
2. **Giảm tải cho Google Sheets API**: Hạn chế số lần gọi API không cần thiết
3. **Tiết kiệm bandwidth**: Chỉ đọc dữ liệu từ Google Sheets khi cache hết hạn

## Lưu ý

- Cache được lưu trong memory của server, sẽ bị xóa khi restart server
- Nếu bạn cập nhật dữ liệu trên Google Sheets và muốn áp dụng ngay, hãy xóa cache thủ công
- Trong môi trường production với nhiều instances, cân nhắc sử dụng distributed cache (Redis)

## Các file liên quan

- `/lib/cache.ts`: Logic cache chính
- `/app/api/scanner/search/route.ts`: API tìm kiếm có tích hợp cache
- `/app/api/scanner/cache/route.ts`: API quản lý cache (xóa, kiểm tra)
