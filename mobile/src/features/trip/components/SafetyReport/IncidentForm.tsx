import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const IncidentForm = () => {
  const { incident } = TRIP_MOCK_DATA.safetyReportData;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🚑</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.subTitle}>HỆ THỐNG KIỂM SOÁT RỦI RO</Text>
          <Text style={styles.title}>Lập Báo Cáo Sự Cố Hiện Trường</Text>
        </View>
        <View style={styles.incBadge}>
          <Text style={styles.incText}>INC-8924-01</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phân loại sự cố hiện trường: <Text style={styles.labelHighlight}>ĐÃ CHỌN Y TẾ</Text></Text>
        <View style={styles.dropdown}>
          <Text style={styles.dropdownText}>🦴 {incident.type}</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mức độ nghiêm trọng & Đánh giá phản ứng:</Text>
        <View style={styles.severityBox}>
          <Text style={styles.severityTitle}>⚠️ {incident.severity}</Text>
          <Text style={styles.severityDesc}>Không đe dọa sinh tồn. Không cần huy động SAR đường không (Trực thăng).</Text>
        </View>
      </View>

      <View style={styles.gpsCard}>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>THỜI GIAN & TỌA ĐỘ GPS GHI NHẬN</Text>
          <Text style={styles.gpsLock}>Khớp InReach Lock</Text>
        </View>
        <View style={styles.gpsDataRow}>
          <Text style={styles.gpsTimeLoc}>📍 {incident.time} • {incident.location}</Text>
        </View>
        <View style={styles.gpsCoordsRow}>
          <Text style={styles.gpsCoords}>{incident.gps}</Text>
          <Text style={styles.gpsCoords}>Độ cao: {incident.elevation}</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Thành viên gặp sự cố:</Text>
        <View style={styles.victimBox}>
          <Text style={styles.victimName}>👤 {incident.victim}</Text>
          <Text style={styles.victimId}>{incident.victimId}</Text>
          <Text style={styles.victimGroup}>Nhóm B (Tốp giữa)</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Thao tác sơ cứu WFA đã xử lý tại chỗ:</Text>
        <View style={styles.textarea}>
          <Text style={styles.textValue}>{incident.actions}</Text>
        </View>
      </View>
      
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Nhu cầu hỗ trợ từ Hub tiếp viện:</Text>
        <View style={[styles.textarea, styles.requestBox]}>
          <Text style={styles.requestText}>🏥 {incident.supportRequest}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>💾 LƯU NỘI BỘ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn}>
          <Text style={styles.sendBtnText}>☁️ GỬI VỀ VFRS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  titleContainer: {
    flex: 1,
  },
  subTitle: {
    fontSize: 10,
    color: '#C62828',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  incBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  incText: {
    color: '#C62828',
    fontSize: 10,
    fontWeight: 'bold',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  labelHighlight: {
    color: '#C62828',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  severityBox: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB300',
    padding: 12,
    borderRadius: 4,
  },
  severityTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#FF8F00',
    marginBottom: 4,
  },
  severityDesc: {
    fontSize: 12,
    color: '#666',
  },
  gpsCard: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
  },
  gpsLock: {
    fontSize: 10,
    color: '#1565C0',
    fontWeight: 'bold',
  },
  gpsDataRow: {
    marginBottom: 8,
  },
  gpsTimeLoc: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gpsCoordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gpsCoords: {
    fontSize: 12,
    color: '#666',
  },
  victimBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    borderRadius: 8,
  },
  victimName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 8,
  },
  victimId: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    marginRight: 8,
  },
  victimGroup: {
    fontSize: 12,
    color: '#666',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  textValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  requestBox: {
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
    minHeight: 'auto',
  },
  requestText: {
    color: '#1565C0',
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  saveBtnText: {
    color: '#333',
    fontWeight: 'bold',
  },
  sendBtn: {
    flex: 1,
    backgroundColor: '#1B5E20',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
