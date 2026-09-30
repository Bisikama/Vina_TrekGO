import { FeaturePreviewScreen } from '@/screens/feature-preview';

export default function AccountRoute() {
  return (
    <FeaturePreviewScreen
      title="Tài khoản Trekker"
      description="Quản lý hồ sơ, cấp độ VFRS, liên hệ khẩn cấp và cài đặt."
      icon={{
        ios: 'person.crop.circle.fill',
        android: 'account_circle',
        web: 'account_circle',
      }}
    />
  );
}