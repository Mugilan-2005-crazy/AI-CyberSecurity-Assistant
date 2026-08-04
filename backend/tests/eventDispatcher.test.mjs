import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { dispatch, dispatchToUser, dispatchToOrg } from '../src/socket/eventDispatcher.js';
import { userRoom, orgRoom } from '../src/socket/roomManager.js';

describe('Event Dispatcher', () => {
  let ioMock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    test('should emit to correct room for user target', () => {
      const emitMock = jest.fn();
      ioMock = {
        to: jest.fn(() => ({ emit: emitMock })),
      };
      dispatch(ioMock, 'user_user123', 'test.event', { data: 'test' });
      expect(ioMock.to).toHaveBeenCalledWith(userRoom('user123'));
      expect(emitMock).toHaveBeenCalledWith('test.event', { data: 'test' });
    });

    test('should emit to correct room for org target', () => {
      const emitMock = jest.fn();
      ioMock = {
        to: jest.fn(() => ({ emit: emitMock })),
      };
      dispatch(ioMock, 'org_org123', 'test.event', { data: 'test' });
      expect(ioMock.to).toHaveBeenCalledWith(orgRoom('org123'));
      expect(emitMock).toHaveBeenCalledWith('test.event', { data: 'test' });
    });

    test('should do nothing when io is null', () => {
      expect(() => dispatch(null, 'user_user123', 'test.event', {})).not.toThrow();
    });

    test('should suppress duplicate events with dedupe option', () => {
      const emitMock = jest.fn();
      ioMock = {
        to: jest.fn(() => ({ emit: emitMock })),
      };
      const payload = { data: 'duplicate' };
      dispatch(ioMock, 'user_user123', 'test.event', payload, { dedupe: true });
      dispatch(ioMock, 'user_user123', 'test.event', payload, { dedupe: true });
      expect(emitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispatchToUser', () => {
    test('should dispatch to user room', () => {
      const emitMock = jest.fn();
      ioMock = {
        to: jest.fn(() => ({ emit: emitMock })),
      };
      dispatchToUser(ioMock, 'user456', 'user.event', { foo: 'bar' });
      expect(ioMock.to).toHaveBeenCalledWith(userRoom('user456'));
      expect(emitMock).toHaveBeenCalledWith('user.event', { foo: 'bar' });
    });
  });

  describe('dispatchToOrg', () => {
    test('should dispatch to org room', () => {
      const emitMock = jest.fn();
      ioMock = {
        to: jest.fn(() => ({ emit: emitMock })),
      };
      dispatchToOrg(ioMock, 'org789', 'org.event', { foo: 'baz' });
      expect(ioMock.to).toHaveBeenCalledWith(orgRoom('org789'));
      expect(emitMock).toHaveBeenCalledWith('org.event', { foo: 'baz' });
    });
  });
});
