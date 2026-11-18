import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';

// The groups tab of the administration lists the projects left without a group. BFF_user takes them from
// BFF_Project (`GET /project-groups/projects-without-group`), simulated from its installed contract
// @mairie360/bff-project-openapi, after its own admin check against Core API.

import { ContractMockServer } from './support/contract-mock-server';
import { OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract } from './support/orval-contract';
import { loadCoreApiContract, meResponse, sessionToken, useSessionPublicKey } from './support/core-fixtures';
import { captureLogs } from './support/logs';

const coreApi = new ContractMockServer('CORE_API', loadCoreApiContract());
const projectBff = new ContractMockServer('PROJECT_BFF', loadOrvalContract('@mairie360/bff-project-openapi'));
const ME = '/api/v1/user/me/';
const WITHOUT_GROUP = '/project-groups/projects-without-group';
const bffContract = OpenApiContract.load(path.join(__dirname, '..', 'contracts', 'openapi.json'));
const SESSION = sessionToken(1);

let app: Express;

beforeAll(async () => {
  await Promise.all([coreApi.start(), projectBff.start()]);
  useSessionPublicKey();
  process.env.CORE_API_URL = coreApi.url;
  process.env.PROJECT_BFF_URL = projectBff.url;
  ({ app } = await import('../src/app'));
});
afterAll(async () => { await Promise.all([coreApi.stop(), projectBff.stop()]); });

beforeEach(() => {
  captureLogs();
  coreApi.reset();
  projectBff.reset();
  process.env.CORE_API_URL = coreApi.url;
  process.env.PROJECT_BFF_URL = projectBff.url;
  delete process.env.PROJECT_BFF_PORT;
  coreApi.on('get', ME, { body: meResponse({ role: 'Admin' }) });
});

afterEach(() => {
  jest.restoreAllMocks();
  expect(coreApi.violations).toEqual([]);
  expect(projectBff.violations).toEqual([]);
});

function expectBffContract(response: request.Response) {
  const match = bffContract.match('get', '/admin/projects-without-group');
  expect(match?.template).toBeDefined();
  const { documented, schema } = bffContract.responseSchema(match!, response.status);
  expect({ status: response.status, documented }).toEqual({ status: response.status, documented: true });
  if (schema && response.type === 'application/json') expect(bffContract.validate(schema, response.body)).toEqual([]);
}

describe('MAIR-683 projects without a group for the administration', () => {
  test('mair_683 the administrator gets the projects without a group and their count, with the caller session forwarded', async () => {
    projectBff.on('get', WITHOUT_GROUP, { body: { projects: [
      { id: 'project-9', title: 'LED street lighting', createdAt: '2026-03-03T09:12:00+00:00' },
      { id: 'project-4', title: 'Gymnasium', createdAt: null },
    ] } });

    const response = await request(app).get('/admin/projects-without-group').set('Authorization', `Bearer ${SESSION}`);

    expect(response.status).toBe(200);
    expectBffContract(response);
    expect(response.body).toEqual({ total: 2, projects: [
      { id: 'project-9', title: 'LED street lighting', createdAt: '2026-03-03T09:12:00+00:00' },
      { id: 'project-4', title: 'Gymnasium', createdAt: null },
    ] });
    expect(projectBff.requests).toHaveLength(1);
    expect(projectBff.requests[0].headers.authorization).toBe(`Bearer ${SESSION}`);
  });

  test('mair_683 a caller without the admin role gets 403 and BFF_Project is never called', async () => {
    coreApi.on('get', ME, { body: meResponse({ role: 'User' }) });

    const response = await request(app).get('/admin/projects-without-group').set('Authorization', `Bearer ${SESSION}`);

    expect(response.status).toBe(403);
    expectBffContract(response);
    expect(projectBff.requests).toEqual([]);
  });

  test('mair_683 a call without session gets 401 before any upstream call', async () => {
    const response = await request(app).get('/admin/projects-without-group');

    expect(response.status).toBe(401);
    expect(coreApi.requests).toEqual([]);
    expect(projectBff.requests).toEqual([]);
  });

  test('mair_683 the 403 of BFF_Project is relayed', async () => {
    // orval does not type the error answers: the 403 is outside the reconstructed contract.
    projectBff.on('get', WITHOUT_GROUP, { status: 403, body: { error: { code: 'FORBIDDEN', message: 'Forbidden.' } }, outOfContract: true });

    const response = await request(app).get('/admin/projects-without-group').set('Authorization', `Bearer ${SESSION}`);

    expect(response.status).toBe(403);
    expectBffContract(response);
    expect(projectBff.requests).toHaveLength(1);
  });

  test('mair_683 a missing PROJECT_BFF_URL answers a declared 503 without calling BFF_Project', async () => {
    delete process.env.PROJECT_BFF_URL;

    const response = await request(app).get('/admin/projects-without-group').set('Authorization', `Bearer ${SESSION}`);

    expect(response.status).toBe(503);
    expectBffContract(response);
    expect(projectBff.requests).toEqual([]);
  });
});
