import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { TRIP_MOCK_DATA } from '../../mockData';

export const MessageList = () => {
  const { messages } = TRIP_MOCK_DATA.groupChatData;

  return (
    <ScrollView style={styles.container}>
      {messages.map((msg, idx) => (
        <View key={idx} style={[styles.msgWrapper, msg.isMe ? styles.msgRight : styles.msgLeft]}>
          {!msg.isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{msg.sender.charAt(0)}</Text>
            </View>
          )}
          
          <View style={styles.msgContentWrapper}>
            {!msg.isMe && (
              <View style={styles.senderInfo}>
                <Text style={styles.senderName}>{msg.sender}</Text>
                {msg.role && (
                  <View style={[styles.roleBadge, msg.role === 'STAFF' ? styles.roleStaff : styles.roleLeader]}>
                    <Text style={styles.roleText}>{msg.role}</Text>
                  </View>
                )}
                <Text style={styles.time}>{msg.time}</Text>
              </View>
            )}
            
            {msg.isMe && (
              <View style={styles.senderInfoRight}>
                <Text style={styles.time}>{msg.sender} • {msg.time}</Text>
              </View>
            )}

            <View style={[styles.bubble, msg.isMe ? styles.bubbleMe : styles.bubbleOther]}>
              {msg.hasImage && (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imageText}>📷 {msg.location}</Text>
                </View>
              )}
              <Text style={[styles.msgText, msg.isMe && styles.msgTextMe]}>{msg.content}</Text>
              
              {msg.extra && (
                <View style={styles.extraBox}>
                  <Text style={styles.extraText}>✔️ {msg.extra}</Text>
                </View>
              )}
              {msg.gps && (
                <View style={styles.gpsBox}>
                  <Text style={styles.gpsText}>📍 {msg.location}</Text>
                  <Text style={styles.gpsCoords}>{msg.gps}</Text>
                </View>
              )}
            </View>
            
            {msg.pending && (
              <Text style={styles.pendingText}>🔄 ĐANG CHỜ GỬI (OFFLINE QUEUE)</Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  msgWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  msgLeft: {
    justifyContent: 'flex-start',
  },
  msgRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00695C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
  },
  msgContentWrapper: {
    maxWidth: '80%',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderInfoRight: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  senderName: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 4,
  },
  roleBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  roleStaff: {
    backgroundColor: '#E1F5FE',
  },
  roleLeader: {
    backgroundColor: '#E8F5E9',
  },
  roleText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
  },
  time: {
    fontSize: 10,
    color: '#999',
  },
  bubble: {
    padding: 12,
    borderRadius: 12,
  },
  bubbleOther: {
    backgroundColor: 'white',
    borderTopLeftRadius: 0,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#1B5E20',
    borderTopRightRadius: 0,
  },
  msgText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  msgTextMe: {
    color: 'white',
  },
  extraBox: {
    marginTop: 8,
    backgroundColor: '#F5F5F5',
    padding: 4,
    borderRadius: 4,
  },
  extraText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  imagePlaceholder: {
    height: 100,
    backgroundColor: '#CFD8DC',
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'flex-end',
    padding: 8,
  },
  imageText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  gpsBox: {
    marginTop: 8,
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  gpsCoords: {
    fontSize: 10,
    color: '#666',
  },
  pendingText: {
    fontSize: 10,
    color: '#1565C0',
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    marginTop: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
