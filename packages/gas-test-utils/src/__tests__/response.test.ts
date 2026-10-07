import { describe, expect, it } from 'vitest';
import { createMockResponse } from '../index.js';

describe('Test Setup Utilities', () => {
  describe('createMockResponse helper', () => {
    it('should create mock response with default values', () => {
      const mockData = { id: 'test', name: 'Test Item' };
      const response = createMockResponse(mockData);

      expect(response.getResponseCode()).toBe(200);
      expect(response.getContentText()).toBe(JSON.stringify(mockData));
      expect(response.getAllHeaders()).toEqual({});
    });

    it('should create mock response with custom status code', () => {
      const mockData = { error: 'Not found' };
      const response = createMockResponse(mockData, 404);

      expect(response.getResponseCode()).toBe(404);
      expect(response.getContentText()).toBe(JSON.stringify(mockData));
    });

    it('should create mock response with custom headers', () => {
      const mockData = { items: [] };
      const customHeaders = {
        'X-Pagination': '{"page":1,"total_pages":2,"last_page":false}',
        'Content-Type': 'application/json'
      };
      const response = createMockResponse(mockData, 200, customHeaders);

      expect(response.getResponseCode()).toBe(200);
      expect(response.getContentText()).toBe(JSON.stringify(mockData));
      expect(response.getAllHeaders()).toEqual(customHeaders);
    });

    it('should handle string data', () => {
      const stringData = 'Plain text response';
      const response = createMockResponse(stringData);

      expect(response.getResponseCode()).toBe(200);
      expect(response.getContentText()).toBe(JSON.stringify(stringData));
    });

    it('should handle array data', () => {
      const arrayData = [{ id: 1 }, { id: 2 }];
      const response = createMockResponse(arrayData);

      expect(response.getResponseCode()).toBe(200);
      expect(response.getContentText()).toBe(JSON.stringify(arrayData));
    });

    it('should be useful for rate limiting scenarios', () => {
      const rateLimitResponse = createMockResponse({ error: 'Too Many Requests' }, 429, { 'Retry-After': '2' });

      expect(rateLimitResponse.getResponseCode()).toBe(429);
      expect(rateLimitResponse.getAllHeaders()['Retry-After']).toBe('2');
    });

    it('should be useful for pagination scenarios', () => {
      const paginatedResponse = createMockResponse({ data: [{ id: 1 }, { id: 2 }] }, 200, {
        'X-Pagination': '{"page":1,"total_pages":3,"last_page":false}'
      });

      expect(paginatedResponse.getResponseCode()).toBe(200);
      const parsedBody = JSON.parse(paginatedResponse.getContentText());
      expect(parsedBody.data).toHaveLength(2);

      const paginationHeader = paginatedResponse.getAllHeaders()['X-Pagination'];
      const paginationData = JSON.parse(paginationHeader);
      expect(paginationData.total_pages).toBe(3);
      expect(paginationData.last_page).toBe(false);
    });
  });
});
