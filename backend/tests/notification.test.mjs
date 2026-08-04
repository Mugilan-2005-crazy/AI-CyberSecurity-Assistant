import { jest } from '@jest/globals';
import request from 'supertest';
import { createNotification, createTestUser, initDB, cleanupDB } from './bootstrap.mjs';
import Notification from '../src/models/Notification.js';

let app, token, testUser;

beforeAll(async () => {
  await initDB();
  testUser = await createTestUser({ email: 'notif-test@test.com', password: 'testpass123' });

  const { default: appModule } = await import('../src/app.js');
  app = appModule;

  const res = await request(app).post('/api/auth/login').send({
    email: 'notif-test@test.com',
    password: 'testpass123',
  });
  token = res.body?.accessToken;
});

afterAll(async () => {
  await cleanupDB();
  await import('mongoose').then((m) => m.default.connection.close());
});

beforeEach(async () => {
  await Notification.deleteMany({ user: testUser._id });
});

describe('Notification API', () => {
  describe('GET /api/notifications', () => {
    test('should return paginated notifications', async () => {
      await createNotification(testUser._id, { title: 'Test 1', read: false });
      await createNotification(testUser._id, { title: 'Test 2', read: true });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.unreadCount).toBe(1);
    });

    test('should filter by category', async () => {
      await createNotification(testUser._id, { category: 'scan_complete', title: 'Scan Alert' });
      await createNotification(testUser._id, { category: 'threat', title: 'Threat Alert' });

      const res = await request(app)
        .get('/api/notifications?category=scan_complete')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].category).toBe('scan_complete');
    });

    test('should filter by read status', async () => {
      await createNotification(testUser._id, { read: false });
      await createNotification(testUser._id, { read: true });

      const res = await request(app)
        .get('/api/notifications?read=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].read).toBe(false);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    test('should return unread count', async () => {
      await createNotification(testUser._id, { read: false });
      await createNotification(testUser._id, { read: false });
      await createNotification(testUser._id, { read: true });

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    test('should mark notification as read', async () => {
      const notif = await createNotification(testUser._id, { read: false });

      const res = await request(app)
        .post(`/api/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const updated = await Notification.findById(notif._id);
      expect(updated.read).toBe(true);
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    test('should mark all notifications as read', async () => {
      await createNotification(testUser._id, { read: false });
      await createNotification(testUser._id, { read: false });

      const res = await request(app)
        .post('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('2');
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    test('should delete notification', async () => {
      const notif = await createNotification(testUser._id);

      const res = await request(app)
        .delete(`/api/notifications/${notif._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const deleted = await Notification.findById(notif._id);
      expect(deleted).toBeNull();
    });
  });

  describe('GET /api/notifications (unauthorized)', () => {
    test('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });
});
