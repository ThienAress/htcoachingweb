import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import TrainerSubscription from '../models/TrainerSubscription.js';
import { resolveDefaultAdminTrainer } from './defaultAdminTrainer.service.js';

const error = (statusCode, codeName, message) => Object.assign(new Error(message), { statusCode, codeName });
const validId = (id) => mongoose.isValidObjectId(id);
export const isCoachAssignmentError = (cause) => [
  'TRAINER_ASSIGNMENT_REQUIRED', 'INVALID_DEFAULT_TRAINER_CONFIG', 'INVALID_DEFAULT_TRAINER',
  'INVALID_ASSIGNED_TRAINER', 'COACH_ASSIGNMENT_CONFLICT', 'NO_ACTIVE_ORDER', 'COACH_ASSIGNMENT_LIMIT',
].includes(cause?.codeName);

// Request-local batch context only, never an authorization cache across requests.
export const prepareCoachResolution = async ({ orders, session = null, env = process.env }) => {
  const ids = [...new Set(orders.filter(o => o.trainerId != null).map(o => String(o.trainerId)))];
  if (ids.some(id => !validId(id))) throw error(409, 'INVALID_ASSIGNED_TRAINER', 'HLV được phân công không hợp lệ');
  const queries = [
    User.find({ _id: { $in: ids } }).select('_id role').session(session).lean(),
    TrainerSubscription.find({ userId: { $in: ids }, isActive: true, status: 'active', endDate: { $gt: new Date() } }).select('userId').session(session).lean(),
  ];
  // MongoDB transactions do not support parallel operations on one session.
  const [users, subscriptions] = session ? [await queries[0], await queries[1]] : await Promise.all(queries);
  const subscribed = new Set(subscriptions.map(s => String(s.userId)));
  const eligibleIds = new Set(users.filter(u => ['trainer','admin'].includes(u.role) || subscribed.has(String(u._id))).map(u => String(u._id)));
  let lead = null, leadError = null;
  if (orders.some(o => o.trainerId == null)) {
    try { lead = await resolveDefaultAdminTrainer({ env, session }); }
    catch (cause) { if (!isCoachAssignmentError(cause)) throw cause; leadError = cause; }
  }
  return { eligibleIds, leadId: lead?._id || null, leadError };
};

export const resolveOrderCoach = async ({ order, session = null, env = process.env, resolution = null }) => {
  if (!order) throw error(403, 'NO_ACTIVE_ORDER', 'Không có đơn coaching phù hợp');
  const context = resolution || await prepareCoachResolution({ orders:[order], session, env });
  if (order.trainerId != null) {
    if (!validId(order.trainerId) || !context.eligibleIds.has(String(order.trainerId))) {
      throw error(409, 'INVALID_ASSIGNED_TRAINER', 'HLV được phân công không còn hợp lệ');
    }
    return { trainerId: order.trainerId, assignmentSource:'explicit' };
  }
  if (context.leadError) throw context.leadError;
  if (!context.leadId) throw error(409, 'TRAINER_ASSIGNMENT_REQUIRED', 'Chưa cấu hình HLV chính');
  return { trainerId:context.leadId, assignmentSource:'default_lead' };
};

export const resolveEffectiveClientCoach = async ({ clientId, session = null, env = process.env, orderId = null }) => {
  if (!validId(clientId) || (orderId && !validId(orderId))) throw error(400,'INVALID_COACH_SCOPE','Phạm vi coaching không hợp lệ');
  if (!await User.findById(clientId).select('_id').session(session).lean()) throw error(403,'COACH_CLIENT_NOT_FOUND','Khách hàng không còn tồn tại');
  const orders = await Order.find({ userId:clientId,status:'approved',sessions:{$gt:0},...(orderId ? {_id:orderId} : {}) })
    .sort({ createdAt:-1,_id:-1 }).limit(101).session(session);
  if (!orders.length) throw error(403,'NO_ACTIVE_ORDER','Chưa có gói coaching được duyệt còn buổi');
  if (orders.length > 100) throw error(409,'COACH_ASSIGNMENT_LIMIT','Cần kiểm tra số lượng đơn coaching đang hoạt động');
  const resolution = await prepareCoachResolution({ orders, session, env });
  const resolved = await Promise.all(orders.map(order => resolveOrderCoach({order,resolution})));
  if (new Set(resolved.map(r=>String(r.trainerId))).size !== 1) throw error(409,'COACH_ASSIGNMENT_CONFLICT','Khách có nhiều HLV phụ trách; cần chọn đúng đơn coaching');
  return { order:orders[0], ...resolved[0] };
};

export const assertEffectiveCoachAccess = async ({ actor, clientId, session = null, env = process.env, orderId = null }) => {
  if (!actor || !['trainer','admin'].includes(actor.role) && !actor.canActAsTrainer && !actor.isAdmin && !actor.isTrainer) {
    throw error(403,'COACH_ACCESS_FORBIDDEN','Cần quyền huấn luyện viên');
  }
  const result = await resolveEffectiveClientCoach({clientId,session,env,orderId});
  if (String(result.trainerId) !== String(actor.id)) throw error(403,'COACH_ACCESS_FORBIDDEN','Khách hàng không thuộc phạm vi HLV này');
  return result;
};

export const effectiveCoachOrderFilter = async ({ trainerId, session = null, env = process.env }) => {
  if (!validId(trainerId)) throw error(400,'INVALID_COACH_SCOPE','HLV không hợp lệ');
  let lead;
  try { lead = await resolveDefaultAdminTrainer({session,env}); }
  catch (cause) { if (!isCoachAssignmentError(cause)) throw cause; }
  return lead && String(lead._id) === String(trainerId)
    ? { $or:[{trainerId},{trainerId:null}] } : {trainerId};
};
