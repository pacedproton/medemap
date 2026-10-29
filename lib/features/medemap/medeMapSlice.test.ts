import { configureStore } from '@reduxjs/toolkit';
import reducer, { setDataset, fetchMedeMapData } from './medeMapSlice';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function createTestStore() {
  return configureStore({
    reducer: {
      medeMap: reducer,
    },
  });
}

describe('medeMapSlice dataset handling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('defaults to v1 and requests /api/medemap?dataset=v1', async () => {
    const store = createTestStore();
    mockedAxios.get.mockResolvedValueOnce({ data: { columnOptions: {}, columnOrder: {}, } as any });

    await store.dispatch<any>(fetchMedeMapData());

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/medemap\?dataset=v1&_=\d+$/));
  });

  it('after setDataset(v2) requests /api/medemap?dataset=v2', async () => {
    const store = createTestStore();
    store.dispatch(setDataset('v2'));

    mockedAxios.get.mockResolvedValueOnce({ data: { columnOptions: {}, columnOrder: {}, } as any });

    await store.dispatch<any>(fetchMedeMapData());

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/medemap\?dataset=v2&_=\d+$/));
  });
});