
# TREKGO MOBILE APPLICATION

## 1. Tổng quan ứng dụng

**TrekGo Mobile** là ứng dụng hỗ trợ người dùng trong toàn bộ hành trình trekking, từ giai đoạn tìm kiếm cung đường và chuyến đi phù hợp, đặt chuyến, tổ chức chuyến trekking riêng, thuê trang thiết bị cho đến theo dõi hành trình thực tế bằng GPS.

Ứng dụng Mobile đóng vai trò là giao diện chính dành cho **User** và **Leader** khi sử dụng TrekGo ngoài thực địa. Vì vậy, thiết kế Mobile ưu tiên thao tác nhanh, giao diện trực quan, bản đồ dễ quan sát và khả năng truy cập nhanh các chức năng quan trọng trong chuyến đi.

Các nhóm chức năng chính trên Mobile gồm:

- Đăng ký, đăng nhập và quản lý tài khoản.
- Khám phá Destination, Trail và Public Trip.
- Xem chi tiết cung đường trên bản đồ.
- Đặt chỗ tham gia Public Trip.
- Tạo và tham gia Private Trip.
- Quản lý các chuyến đi của người dùng.
- Thuê trang thiết bị trekking.
- Theo dõi thời tiết chuyến đi.
- Sử dụng bản đồ và GPS trong quá trình trekking.
- Theo dõi tiến độ hành trình và checkpoint.
- Cảnh báo khi đi lệch khỏi cung đường.
- Thực hiện nhiệm vụ tại checkpoint.
- Ghi lại cung đường cá nhân.
- Quản lý hồ sơ và lịch sử hoạt động.

TrekGo phân biệt rõ hai loại chuyến đi. **Public Trip** là chuyến thương mại được Leader tổ chức và User tham gia thông qua Booking. **Private Trip** là chuyến riêng do User tự tạo và các thành viên tham gia bằng mã hoặc liên kết mời.

---

# 2. Cấu trúc giao diện Mobile

Ứng dụng có thể sử dụng **Bottom Navigation Bar** gồm 5 khu vực chính:

**Home – Explore – Trips – Rental – Profile**

Trong đó:

**Home** là màn hình tổng quan, hiển thị chuyến sắp tới, gợi ý cung đường, thời tiết và các hành động nhanh.

**Explore** là khu vực khám phá Destination, System Trail và Public Trip.

**Trips** quản lý toàn bộ chuyến đi của người dùng, bao gồm Public Trip đã Booking, Private Trip và chuyến đang diễn ra.

**Rental** dùng để tìm kiếm, thuê và theo dõi thiết bị trekking.

**Profile** quản lý thông tin cá nhân, Personal Trail, Trail đã mua quyền truy cập, lịch sử chuyến đi và các thiết lập tài khoản.

Khi một Trip chuyển sang trạng thái **IN_PROGRESS**, trải nghiệm Mobile chuyển trọng tâm sang giao diện **Trip Navigation**, trong đó bản đồ và GPS trở thành thành phần chính.

---

# 3. Luồng Authentication

## 3.1. Splash Screen

Khi mở ứng dụng, người dùng nhìn thấy logo TrekGo trên màn hình Splash.

Ứng dụng kiểm tra session hiện tại.

Nếu session còn hợp lệ, người dùng được chuyển trực tiếp vào Home. Nếu chưa đăng nhập hoặc session không còn hợp lệ, ứng dụng chuyển đến màn hình Welcome/Login.

Authentication của TrekGo sử dụng Supabase; Mobile giữ session thông qua SDK và sử dụng access token khi gọi TrekGo Backend.

## 3.2. Login

Màn hình Login gồm:

Email  
Password  
Forgot Password  
Login  
Create Account

Sau khi đăng nhập thành công, người dùng được chuyển đến Home.

## 3.3. Register

Màn hình đăng ký sử dụng form đơn giản với các thông tin cơ bản như họ tên, email, mật khẩu và xác nhận mật khẩu.

Sau khi tạo tài khoản thành công, TrekGo tạo hồ sơ ứng dụng tương ứng với tài khoản Authentication.

---

# 4. Home Screen

Home là màn hình đầu tiên sau khi đăng nhập.

Phía trên màn hình hiển thị avatar và lời chào người dùng.

Ngay bên dưới có thể đặt thanh tìm kiếm:

**“Bạn muốn trekking ở đâu?”**

Phần nội dung chính sử dụng các card lớn theo chiều dọc.

Card **Upcoming Trip** hiển thị chuyến sắp tới gồm ảnh Destination, tên chuyến, ngày bắt đầu, Leader và trạng thái.

Nếu người dùng đang có Trip diễn ra, card này được ưu tiên thành:

**Trip đang diễn ra → Continue Navigation**

Tiếp theo là các section:

**Popular Destinations**  
Danh sách địa điểm trekking nổi bật.

**Recommended Trails**  
Các cung đường được gợi ý.

**Upcoming Public Trips**  
Các chuyến công khai sắp diễn ra.

**Weather**  
Thời tiết tại Destination hoặc Trip sắp tới.

Home không nên chứa quá nhiều chức năng quản lý mà chủ yếu giúp User nhanh chóng tiếp tục hành trình hoặc khám phá nội dung mới.

---

# 5. Luồng khám phá Trail

## 5.1. Explore Screen

Explore sử dụng thanh Search ở phía trên.

Bên dưới có filter dạng chip:

**Destination – Difficulty – Distance – Price**

Danh sách Trail hiển thị dưới dạng card.

Mỗi Trail Card có:

Ảnh đại diện  
Tên Trail  
Destination  
Độ khó  
Khoảng cách  
Thời gian dự kiến  
Giá quyền truy cập nếu có

User nhấn vào card để mở Trail Detail.

## 5.2. Trail Detail

Phần đầu màn hình là ảnh lớn của khu vực trekking.

Bên dưới là:

Tên Trail  
Difficulty  
Distance  
Elevation Gain  
Estimated Duration

Một bản đồ preview hiển thị route và các checkpoint.

Phần tiếp theo mô tả cung đường, thông tin địa hình và checkpoint.

Nếu Trail cần mua quyền truy cập, cuối màn hình có CTA:

**Unlock Trail**

Nếu User đã có quyền:

**Create Private Trip**

System Trail thuộc TrekGo; Personal Trail thuộc User. Public Trip sử dụng System Trail, trong khi Private Trip có thể sử dụng Personal Trail của User hoặc System Trail mà User đã có quyền truy cập.

---

# 6. Luồng Public Trip

Luồng chính:

**Explore → Public Trip → Trip Detail → Booking → Payment → Booking Confirmed**

## 6.1. Public Trip List

User có thể tìm Public Trip theo:

Destination  
Ngày đi  
Difficulty  
Price  
Availability

Trip Card hiển thị:

Ảnh Destination  
Tên chuyến  
Leader  
Ngày bắt đầu  
Difficulty  
Số chỗ còn lại  
Giá

## 6.2. Public Trip Detail

Màn hình chi tiết hiển thị:

Tên chuyến  
Ảnh Destination  
Leader  
Ngày bắt đầu/kết thúc  
Pickup Point  
Trail  
Checkpoint  
Difficulty  
Số người tối đa  
Số chỗ còn lại  
Giá

Có bản đồ nhỏ để preview cung đường.

CTA cố định phía dưới:

**Book Trip**

## 6.3. Booking

User chọn số lượng Participant và nhập thông tin những người đi cùng.

Màn hình Review Booking hiển thị:

Trip  
Ngày đi  
Pickup Point  
Participant  
Giá/người  
Tổng tiền

Sau đó User chọn:

**Proceed to Payment**

Khi thanh toán thành công, màn hình hiển thị trạng thái:

**Booking Confirmed**

Public Trip sử dụng Booking + Payment, và một Booking có thể chứa nhiều Participant.

---

# 7. My Trips

Màn hình Trips chia thành các tab:

**Upcoming | Ongoing | Completed**

Mỗi Trip Card hiển thị:

Tên Trip  
Public/Private  
Ngày  
Destination  
Trạng thái

Đối với chuyến sắp diễn ra, User có thể mở **Trip Preparation**.

Trip Preparation tập hợp những thông tin cần trước chuyến:

Weather  
Pickup Point  
Trail  
Checklist  
Rental Equipment  
Participants  
Transport

Nếu Booking Public Trip đã được xác nhận, User có thể xem thêm thông tin xe như biển số, tài xế và số điện thoại theo chính sách hiển thị của hệ thống.

---

# 8. Luồng Private Trip

Luồng:

**My Trips → Create Private Trip → Select Trail → Trip Information → Create → Invite Friends**

User nhấn nút:

**+ Create Private Trip**

Sau đó chọn Trail từ:

**My Personal Trails**

hoặc

**Purchased/System Trails**

Tiếp theo User nhập:

Trip Name  
Start Date  
End Date  
Pickup Point  
Capacity

Sau khi tạo thành công, ứng dụng hiển thị **Private Trip Detail**.

Màn hình này có:

Thông tin chuyến  
Trail  
Checkpoint  
Danh sách thành viên  
Invite Code  
Share Invite Link

Host có thể copy hoặc chia sẻ link cho bạn bè.

Người nhận link mở màn hình:

**Private Trip Invitation**

Màn hình hiển thị tên Trip, Host, thời gian, Trail và số chỗ còn lại.

CTA:

**Join Trip**

Private Trip không sử dụng Booking và không bán slot; thành viên tham gia bằng invite nếu chuyến còn capacity.

---

# 9. Luồng Rental Equipment

Rental được thiết kế gắn với chuyến đi.

Luồng User:

**Trip → Rent Equipment → Catalog → Product Detail → Select Quantity → Rental Summary → Payment → Track Rental**

User chỉ được thuê khi có Public Booking đã xác nhận hoặc là thành viên hợp lệ của Private Trip.

## 9.1. Rental Catalog

Phía trên là Trip đang được thuê thiết bị cho:

**Equipment for: Tà Năng Trekking – 20 Oct**

Bên dưới là category:

Tent  
Backpack  
Trekking Pole  
Sleeping Bag  
Accessories

Product Card hiển thị:

Ảnh  
Tên sản phẩm  
Giá thuê/ngày  
Tiền cọc  
Availability

## 9.2. Rental Product Detail

Hiển thị:

Gallery ảnh  
Tên thiết bị  
Mô tả  
Giá/ngày  
Deposit  
Thông tin sử dụng  
Quantity

CTA:

**Add to Rental**

## 9.3. Rental Summary

User kiểm tra:

Danh sách thiết bị  
Số lượng  
Thời gian thuê  
Rental Fee  
Deposit  
Total

Sau đó tiến hành thanh toán.

## 9.4. Rental Tracking

Sau thanh toán, ứng dụng hiển thị timeline:

**Payment Confirmed**

↓

**Preparing Equipment**

↓

**Ready for Delivery**

↓

**Delivered at Pickup Point**

↓

**In Use**

↓

**Return Pending**

↓

**Returned**

↓

**Deposit Refunded / Deducted**

Rental là một chuỗi nghiệp vụ hoàn chỉnh từ kiểm tra availability, reservation, payment, chuẩn bị thiết bị, giao cho User, thu hồi, kiểm tra và xử lý tiền cọc.

---

# 10. Trip Navigation – giao diện quan trọng nhất của Mobile

Khi Trip bắt đầu, User nhấn:

**Start Trekking**

Ứng dụng xin Location Permission nếu chưa có và bắt đầu GPS Session.

Màn hình chuyển sang giao diện Navigation toàn màn hình.

Khoảng **70–80% màn hình** dành cho bản đồ.

Trên bản đồ hiển thị:

Route dự kiến  
Đường User đã đi  
Current Location  
Checkpoint  
Destination  
Các điểm quan trọng

Route dự kiến có thể dùng đường nét rõ, trong khi actual path của User được thể hiện riêng để người dùng phân biệt.

Một floating button cho phép:

**Center My Location**

Ở phía dưới là một **Bottom Sheet** có thể kéo lên/xuống.

Trạng thái thu gọn hiển thị:

Distance  
Time  
Next Checkpoint  
Route Status

Ví dụ:

**6.4 km completed**

**Next checkpoint: Đỉnh Pinhatt – 1.2 km**

**On Route**

Khi kéo Bottom Sheet lên, User thấy thêm:

Trip Progress  
Checkpoint Progress  
Weather  
Participants  
Route information

GPS trên MVP được ghi theo periodic/batch thay vì bắt buộc realtime từng giây, đồng thời actual path được vẽ từ các location sample.

---

# 11. Route Deviation Warning

Trong khi trekking, hệ thống liên tục so sánh GPS của User với active route.

Nếu User đi lệch đủ xa và đủ lâu để vượt rule chống GPS noise, Mobile hiển thị cảnh báo nổi bật:

**⚠ You are off route**

**You are approximately 120m away from the planned trail.**

Hai action:

**View Route**

**Dismiss**

Trên bản đồ, User có thể thấy vị trí hiện tại và đường route để tự quay lại.

Khi quay lại route, ứng dụng hiển thị:

**Back on route**

Đối với Leader, màn hình có thể hiển thị cảnh báo khi một thành viên trong đoàn bị lệch route cùng last-known location. Cơ chế deviation sử dụng threshold và nhiều sample/debounce để tránh cảnh báo giả do GPS nhiễu.

---

# 12. Checkpoint Experience

Checkpoint được hiển thị trực tiếp trên bản đồ.

Ví dụ:

**CP1 → CP2 → CP3 → Finish**

Khi User tiến vào bán kính của checkpoint, hệ thống tự xác nhận GPS.

Bottom Sheet xuất hiện:

**Checkpoint Reached!**

**Đỉnh Langbiang**

**2,167 m**

Nếu checkpoint có Mission:

**Mission Unlocked**

User nhấn:

**View Mission**

Mission Screen có thể chứa:

Tên nhiệm vụ  
Mô tả  
Câu hỏi  
Upload/Take Photo nếu yêu cầu  
Submit Mission

Sau khi hoàn thành:

**Checkpoint Completed ✓**

Progress được cập nhật:

**3 / 5 Checkpoints**

Việc xác nhận checkpoint phải dựa trên GPS và được backend kiểm tra để tránh duplicate; sau khi ARRIVED, mission tương ứng mới được mở.

---

# 13. Weather UI

Weather không cần một module quá lớn mà nên xuất hiện đúng context.

Trên Trip Detail hoặc Trip Preparation, sử dụng Weather Card:

**18°C**

**Light Rain**

**Humidity 82%**

**Wind 12 km/h**

Nếu có rủi ro:

**⚠ Rain risk during your trip**

User có thể nhấn card để xem Weather Detail gồm forecast theo thời gian và các risk flag.

Trong Trip Navigation, Weather nên được thu gọn thành một chip/card nhỏ để không che bản đồ.

Weather chỉ hỗ trợ người dùng và Leader đưa ra quyết định; lỗi Weather Provider không được làm hỏng luồng Booking hoặc Trip.

---

# 14. Personal Trail Recording

Đây có thể là chức năng mở rộng sau MVP.

Từ Profile hoặc My Trails:

**My Trails → Record New Trail**

Màn hình Record Trail gần giống Trip Navigation nhưng đơn giản hơn.

Phía trên là bản đồ.

Bên dưới hiển thị:

Distance  
Duration  
GPS Accuracy

CTA chính:

**Start Recording**

Sau khi bắt đầu:

**Pause | Stop**

Route User đã đi được vẽ trực tiếp trên bản đồ.

Sau khi Stop, màn hình Summary hiển thị:

Route Map  
Distance  
Duration  
Recorded Path

User nhập:

Trail Name  
Description

sau đó:

**Save Personal Trail**

Personal Trail này là Trail riêng của User và có thể được sử dụng để tạo Private Trip. Geometry của Trail không được chỉnh trực tiếp; nếu muốn thay đổi route, User phải record lại Trail mới.

---

# 15. Profile

Profile Screen hiển thị:

Avatar  
Full Name  
Email  
Role  
Rank/Trip statistics nếu triển khai

Các menu chính:

**Personal Information**

**My Bookings**

**My Trips**

**My Trails**

**Purchased Trails**

**Rental Orders**

**Payment History**

**Become a Leader**

**Settings**

**Logout**

Nếu User đủ điều kiện trở thành Leader, mục **Become a Leader** mở flow gồm tiến độ điều kiện, bài kiểm tra, upload certificate và trạng thái xét duyệt.

---

# 16. Leader Mobile Experience

Khi tài khoản có role Leader, Mobile bổ sung các chức năng dành cho quản lý chuyến.

Leader có màn hình:

**My Leading Trips**

Trong Trip Detail có:

Participants  
Check-in  
Trail  
Checkpoints  
Weather  
Start Trip

Trong ngày diễn ra chuyến:

**Participant Check-in → Start Trip → Navigation → Checkpoints → Complete Trip**

Khi Trip đang diễn ra, Leader sử dụng cùng Navigation Screen với User nhưng có thêm các thành phần quản lý:

**Member Alerts**

**Deviation Alerts**

**Checkpoint Progress**

**Switch Trail**

**Complete Trip**

Nếu một thành viên bị lệch route:

**⚠ Nguyễn A is off route**

Leader có thể mở thông tin để xem last-known location của thành viên.

Nếu cần thay đổi cung đường trong quá trình trekking, Leader chọn **Switch Trail**. Sau khi route mới được xác nhận, Mobile cập nhật active route ngay nhưng các Required Checkpoint của chuyến vẫn được giữ nguyên.

---

# 17. Trạng thái UI quan trọng

Mobile cần thể hiện trạng thái bằng badge/chip để User không phải đọc nhiều nội dung.

Ví dụ Trip:

**Upcoming**

**In Progress**

**Completed**

**Cancelled**

Booking:

**Pending Payment**

**Confirmed**

**Checked In**

Rental:

**Preparing**

**Ready**

**In Use**

**Return Pending**

**Returned**

Navigation:

**On Route**

**Off Route**

**Recovered**

Checkpoint:

**Pending**

**Reached**

**Completed**

Các trạng thái nguy hiểm như Off Route, Payment Failed hoặc Weather Risk cần có visual hierarchy mạnh hơn trạng thái thông thường.

---

# 18. Định hướng thiết kế giao diện

UI TrekGo nên mang phong cách **outdoor hiện đại, tối giản và thân thiện**, trong đó bản đồ, hình ảnh Destination và trạng thái chuyến đi là những thành phần nổi bật.

Thiết kế có thể sử dụng nền sáng, card trắng, khoảng trắng rộng và màu xanh lá làm màu CTA chính. Button và card sử dụng bo góc lớn để giao diện thân thiện hơn. Design system tham khảo hiện tại sử dụng accent xanh `#9fe870`, card/button radius khoảng `24px`, body text khoảng `16px` và touch target khoảng `48px`. 

Đối với Mobile, CTA quan trọng như **Book Trip**, **Join Trip**, **Start Trekking**, **Rent Equipment** và **Complete Trip** nên đặt ở cuối màn hình và có kích thước đủ lớn để thao tác bằng một tay.

Các màn hình có bản đồ nên ưu tiên **full-screen map + floating controls + bottom sheet**, thay vì chia bản đồ thành một card nhỏ khi người dùng đang thực sự trekking.

---

# 19. Luồng Mobile tổng thể

Luồng trải nghiệm User có thể mô tả ngắn gọn như sau:

**Login / Register**

→ **Home**

→ **Explore Destination / Trail / Public Trip**

→ **View Detail**

→ **Book Public Trip hoặc Create/Join Private Trip**

→ **Payment / Confirmation**

→ **Trip Preparation**

→ **Rent Equipment**

→ **View Weather**

→ **Check-in**

→ **Start Trip**

→ **3D Map + GPS Tracking**

→ **Route Deviation Detection**

→ **Checkpoint Arrival**

→ **Mission**

→ **Continue Navigation**

→ **Complete Trip**

→ **Return Rental Equipment**

→ **Deposit Settlement**

→ **Trip History**

Đây là luồng quan trọng nhất khi thiết kế Mobile TrekGo vì nó kết nối ba mảng nghiệp vụ chính của hệ thống: **Trip/Booking**, **Rental Equipment** và **GPS/Navigation** thành một trải nghiệm Mobile thống nhất. Requirement tổng cũng đặt tiêu chí MVP theo đúng chuỗi: Authentication → Public/Private Trip → Booking/Membership → GPS/Checkpoint → Rental → Return/Deposit.