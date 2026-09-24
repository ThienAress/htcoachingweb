import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { setupTestDB, teardownTestDB, clearCollections, createTestUser } from '../../__tests__/setup.js';
import Order from '../../models/Order.js';
import User from '../../models/User.js';
import { resolveOrderCoach, resolveEffectiveClientCoach, assertEffectiveCoachAccess, effectiveCoachOrderFilter } from '../effectiveCoach.service.js';
beforeAll(setupTestDB); afterAll(teardownTestDB); afterEach(clearCollections);
const order = (client, trainerId) => Order.create({ userId: client, trainerId, status:'approved', sessions:5, totalSessions:5 });
describe('effective coach canonical relationship', () => {
  it('resolves null to designated lead and excludes another admin', async () => {
    const lead=await createTestUser({role:'admin'}), other=await createTestUser({role:'admin'}), customer=await createTestUser();
    await order(customer.user._id, null);
    const env={DEFAULT_ADMIN_TRAINER_ID:String(lead.user._id)};
    expect(String((await resolveEffectiveClientCoach({clientId:customer.user._id,env})).trainerId)).toBe(String(lead.user._id));
    await expect(assertEffectiveCoachAccess({actor:{id:other.user._id,role:'admin'},clientId:customer.user._id,env})).rejects.toMatchObject({statusCode:403});
    expect(await effectiveCoachOrderFilter({trainerId:other.user._id,env})).toEqual({trainerId:other.user._id});
  });
  it('does not overwrite explicit trainer or fall back from a deleted assignment', async () => {
    const coach=await createTestUser({role:'trainer'});
    const explicit={trainerId:coach.user._id};
    expect((await resolveOrderCoach({order:explicit,env:{}})).assignmentSource).toBe('explicit');
    await User.deleteOne({_id:coach.user._id});
    await expect(resolveOrderCoach({order:explicit,env:{}})).rejects.toMatchObject({codeName:'INVALID_ASSIGNED_TRAINER'});
  });
  it('fails closed on conflicting active trainers, but honors an explicit owned order', async () => {
    const a=await createTestUser({role:'trainer'}), b=await createTestUser({role:'trainer'}), customer=await createTestUser();
    const pinned=await order(customer.user._id,a.user._id); await order(customer.user._id,b.user._id);
    await expect(resolveEffectiveClientCoach({clientId:customer.user._id})).rejects.toMatchObject({codeName:'COACH_ASSIGNMENT_CONFLICT'});
    expect(String((await resolveEffectiveClientCoach({clientId:customer.user._id,orderId:pinned._id})).trainerId)).toBe(String(a.user._id));
  });
  it('missing default and deleted client do not resolve', async () => {
    const customer=await createTestUser(); await order(customer.user._id,null);
    await expect(resolveEffectiveClientCoach({clientId:customer.user._id,env:{}})).rejects.toMatchObject({statusCode:409});
    await User.deleteOne({_id:customer.user._id});
    await expect(resolveEffectiveClientCoach({clientId:customer.user._id,env:{}})).rejects.toMatchObject({statusCode:403});
  });
});
