import { hasBandOnlyConstraint, hasLimitedDumbbellBandConstraint } from './equipmentConstraint.js';

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  .toLowerCase();

const aliases = [
  ['Ngực', /\b(?:nguc|chest)\b/i], ['Lưng', /\b(?:lung|back)\b/i],
  ['Chân', /\b(?:chan|legs?|dui)\b/i], ['Vai', /\b(?:vai|shoulders?)\b/i],
  ['Tay', /\b(?:tay|arms?)\b/i], ['Bụng', /\b(?:bung|core|abs?)\b/i],
];

export const buildExerciseRequest = (message, args = {}) => {
  const text = String(message || '');
  const normalized = normalize(text);
  const explicitCount = normalized.match(/\b(\d{1,2})\s+(?:bai|bài|exercises?)\b/i)?.[1];
  const muscleGroup = aliases.find(([, pattern]) => pattern.test(normalized))?.[0] || args.muscleGroup || undefined;
  const limit = Math.min(Math.max(Number(explicitCount || args.limit || 5), 1), 10);
  const beginner = /\b(?:nguoi moi|beginner|moi bat dau)\b/i.test(normalized) ? 'người mới' : '';
  const equipment = hasLimitedDumbbellBandConstraint(message)
    ? 'chỉ có tạ đơn và dây kháng lực'
    : hasBandOnlyConstraint(message)
      ? 'chỉ dùng dây kháng lực'
      : /\b(?:khong can dung cu|khong dung cu|no equipment|without equipment)\b/i.test(normalized)
        || /\b(?:bodyweight|khong co dung cu)\b/i.test(normalized)
          ? 'không cần dụng cụ' : '';
  const rawSearch = String(args.searchQuery || '').trim();
  let namedExercise = rawSearch;
  if (!namedExercise) {
    namedExercise = text.split(/\n/).at(-1)
      .replace(/^(?:tôi|toi|mình|minh|cho tôi|cho minh)?\s*(?:muốn|muon|tìm|tim|cách tập|cach tap|hướng dẫn|huong dan)\s*/i, '')
      .replace(/^\d{1,2}\s+(?:bài tập|bai tap|exercises?)\s*/i, '')
      .replace(/\b(?:cho người mới|cho nguoi moi|beginner|beginners|chỉ dùng.*|chi dung.*|không cần dụng cụ|khong can dung cu|bodyweight).*$/i, '')
      .trim();
  }
  const groupPrefix = muscleGroup
    ? new RegExp(`^(?:bài tập\\s+)?${muscleGroup}\\s*`, 'i')
    : null;
  const namedTail = groupPrefix ? namedExercise.replace(groupPrefix, '').trim() : '';
  const candidateName = muscleGroup ? namedTail : namedExercise;
  const exerciseName = /\b(?:squat|deadlift|pulldown|pull[ -]?up|push[ -]?up|press|row|curl|plank|lunge|raise|bridge)\b/i.test(candidateName)
    ? candidateName.replace(/[?.!]+$/, '').trim().slice(0, 100) : undefined;
  const base = muscleGroup
    ? `bài tập ${muscleGroup}${namedTail ? ` ${namedTail}` : ''}`
    : (namedExercise || 'bài tập');
  const qualifiers = [beginner, equipment].filter(Boolean).join(' ');
  const available = 100 - qualifiers.length - (qualifiers ? 1 : 0);
  return {
    ...(muscleGroup && { muscleGroup }),
    ...(exerciseName && { exerciseName }),
    limit,
    searchQuery: [base.slice(0, available), qualifiers].filter(Boolean).join(' '),
  };
};

export const isExerciseCatalogRequest = (message) => {
  const text = normalize(message);
  const safetyContext = /\b(?:dau|dau goi|kho chiu|chan thuong|injury|pain|khop goi)\b/i.test(text);
  if (safetyContext && !/\b(?:tim|tìm|danh sach|thu vien|exercise card)\b/i.test(text)) {
    return false;
  }
  return /\b\d{1,2}\s+(?:bai|bài|exercises?)\b/i.test(text) ||
    /\b(?:tim|tìm|goi y|gợi ý|danh sach|exercise card|thư viện bài tập)\b/i.test(text);
};
