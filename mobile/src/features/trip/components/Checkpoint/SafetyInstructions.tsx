import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const SafetyInstructions = () => {
  return (
    <View style={styles.container}>
      <View style={styles.instructionBox}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🌬️</Text>
        </View>
        <View style={styles.textContent}>
          <Text style={styles.title}>Chỉ dẫn an toàn tại CP03</Text>
          <Text style={styles.desc}>
            Khu vực đón gió mạnh, không dựng lều sát mép dốc. Bổ sung nước và kiểm tra khớp gối trước khi đổ dốc Thác Yavly.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmText}>✔️ XÁC NHẬN CHECKPOINT CP03</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  instructionBox: {
    flexDirection: 'row',
    backgroundColor: '#FBE9E7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#FFCCBC',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D84315',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: '#BF360C',
    lineHeight: 20,
  },
  confirmBtn: {
    backgroundColor: '#1B5E20',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
