import { maskVietnameseGeneralPhrases } from "./knowledgeGeneralSyntax.js";

const FIRST_PERSON_SUBJECT_SOURCE = "(?:toi|minh|em|tui|chung toi)";
const PRIVATE_RECORD_SUBJECT_SOURCE =
  "(?:khach hang|hoc vien|benh nhan|nguoi nay|nguoi ben canh toi|mot nguoi|anh ay|co ay|bo toi|me toi|vo toi|chong toi|con toi|ban toi|anh toi|chi toi|em toi|client|patient|customer|member|user|someone next to me|someone|my father|my mother|my wife|my husband|my child|my kid|my son|my daughter|my friend|he|she|they)";

const MEDICAL_CONDITION_SOURCE =
  "(?:benh|dau|chan thuong|viem|sung|sot|te bi|co rut|co giat|thoat vi|dia dem|loang xuong|xuong khop|day chang|cot song|di ung|mang thai|huyet ap|tieu duong|ung thu|hiv|aids|hen suyen|tim mach|benh tim|benh than|suy than|benh gan|suy gan|gan nhiem mo|tram cam|roi loan|trieu chung|dau nguc|kho tho|ngat xiu|dot quy|tu tu|tu sat|tu hai|ket lieu|pcos|hoi chung buong trung da nang|buong trung da nang|da nang buong trung|polycystic ovary syndrome|polycystic ovarian syndrome|acl(?: tear| injury)?|torn acl|autis(?:m|tic)|covid(?:-?19)?|lupus|migraines?|epilepsy|epileptic|diagnos(?:e|ed|is)|allerg(?:y|ic)|pregnan(?:t|cy)|blood pressure|diabetes|diabetic|cancer|asthma|fever|heart attack|seizure|heart disease|kidney disease|liver disease|depression|disorder|injur(?:y|ed)|pain|symptoms?|chest pain|shortness of breath|faint(?:ed|ing)?|stroke|suicid(?:e|al)|self harm|kill myself|hurt myself|end my life|take my life|want to die)";
const CLINICAL_TREATMENT_SOURCE =
  "(?:insulin|metformin|warfarin|prednisone|ozempic|semaglutide|lithium|chemotherapy|chemo|hoa tri|xa tri|dialysis|loc than|medication|medicine|prescription|thuoc)";
const CLINICAL_RECORD_SOURCE =
  `(?:hba1c|a1c|cholesterol|ldl|hdl|triglycerides?|duong huyet|blood glucose|blood sugar|nhip tim|heart rate|bmi|body fat|ty le mo|phan tram mo|vo2max|spo2|oxygen saturation|creatinine|${CLINICAL_TREATMENT_SOURCE})`;

const HEALTH_INFORMATION_PATTERN = new RegExp(
  `\\b${MEDICAL_CONDITION_SOURCE}\\b|\\b${CLINICAL_RECORD_SOURCE}\\b|\\b(?:phau thuat|dieu tri|uong thuoc|dung thuoc|ke don|tu hai|tu tu|surgery|treatment|self harm|suicid(?:e|al))\\b`,
  "i",
);
const FIRST_PERSON_HEALTH_ASSERTION_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+(?:(?:dang|vua|da|moi|tung|duoc|cam thay)\\s+){0,2}(?:bi|mac|co|dau|chan thuong)\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
const PRIVATE_RECORD_HEALTH_ASSERTION_PATTERN = new RegExp(
  `\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,5}\\s+(?:(?:dang|vua|da|moi|tung|duoc)\\s+){0,2}(?:bi|mac|co|dau|chan thuong|has|have|had|suffers? from|injured)\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
const NAMED_PERSON_HEALTH_ASSERTION_PATTERN = new RegExp(
  `(?:^|[.!?\\n]\\s*)(?!(?:tre em|children|nguoi|people|athletes?|beginners?|seniors?)\\b)(?:[a-z][a-z0-9_'-]*\\s+){1,3}(?:bi|mac|co|has|have|had|suffers? from|injured|(?:(?:was|is|are|were)\\s+)?diagnosed(?:\\s+with)?)\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
// Dùng khi cho phép nêu bệnh thông thường: chủ ngữ là vai trò chung ("khách hàng", "học viên") không phải một người cụ thể.
const GENERIC_ROLE_SUBJECT_PATTERN =
  /\b(?:khach hang|hoc vien|benh nhan|nguoi tap|nguoi moi|nguoi lon tuoi|nguoi cao tuoi|nguoi|clients?|patients?|customers?|members?|users?|trainees?)\b/g;
// Chủ ngữ không phải một người có tên: đại từ ngôi thứ nhất, vai trò chung, tên bài tập hoặc bộ phận cơ thể ("Squat bị đau lưng").
// Văn bản tiếng Việt có dấu: cụm "viec tu y gian" không phải tên người; chỉ chủ thể giữ chỗ không dấu mới bị coi là tên.
const VIETNAMESE_DIACRITIC_PATTERN =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
// Khi cho phép nêu bệnh thông thường, các dấu hiệu dưới đây vẫn khiến nội dung bị chặn nếu đi cùng chủ thể cá nhân
// (ngôi thứ nhất, người thân hoặc vai trò chung như "khách hàng").
const COMMON_MODE_SUBJECT_SOURCE =
  "(?:toi|minh|em|tui|chung toi|i|my|me|khach hang|hoc vien|benh nhan|nguoi|clients?|patients?|customers?|members?|users?|trainees?)";
const FIRST_PERSON_OR_RELATIVE_SOURCE = "(?:toi|minh|em|tui|chung toi|i|my|me)";
const RELATIVE_OF_SELF_PATTERN =
  /\b(?:(?:me|bo|cha|ma|vo|chong|con|con trai|con gai|anh|chi|em|em trai|em gai|anh trai|chi gai|ban|ban be|ong|ba|chu|bac|cau|di|dong nghiep)\s+(?:toi|minh)|my\s+(?:mother|mom|father|dad|wife|husband|son|daughter|child|kid|brother|sister|friend|partner|boyfriend|girlfriend|colleague|coworker|parents?)|(?:his|her|their)\s+(?:mother|father|wife|husband|son|daughter))\b/;
const SELF_DIAGNOSIS_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_OR_RELATIVE_SOURCE}\\b[^.!?\\n]{0,60}\\b(?:chan doan|diagnos\\w*)\\b|\\b(?:chan doan|diagnos\\w*)\\b[^.!?\\n]{0,40}\\b${FIRST_PERSON_OR_RELATIVE_SOURCE}\\b`,
  "i",
);
const CLINICAL_EVENT_WORD_SOURCE =
  "(?:phau thuat|sau mo|vua mo|da mo|mo thoat vi|mo tim|mo day chang|nhap vien|dieu tri|kham bac si|di kham|vat ly tri lieu|neutral_hospital|surgery|surgical|hospitali[sz]ed|rehab|operation)";
const SENSITIVE_CATEGORY_WORD_SOURCE =
  "(?:ung thu|cancer|hiv|aids|suy than|suy tim|tu ky|autis\\w*|tram cam|depress\\w*|roi loan|lo au|anxiety|bipolar|tam than|schizo\\w*|mang thai|thai ky|pregnan\\w*|dot quy|stroke|nhoi mau|heart attack|dau tim|dong kinh|epilep\\w*)";
const COMMON_MODE_SENSITIVE_PATTERN = new RegExp(
  `\\b${COMMON_MODE_SUBJECT_SOURCE}\\b[^.!?\\n]{0,80}\\b(?:${CLINICAL_EVENT_WORD_SOURCE}|${SENSITIVE_CATEGORY_WORD_SOURCE})\\b|\\b(?:${CLINICAL_EVENT_WORD_SOURCE}|${SENSITIVE_CATEGORY_WORD_SOURCE})\\b[^.!?\\n]{0,40}\\b${COMMON_MODE_SUBJECT_SOURCE}\\b`,
  "i",
);
const COMMON_MODE_MEASURED_PATTERN = new RegExp(
  `\\b${COMMON_MODE_SUBJECT_SOURCE}\\b[^.!?\\n]{0,60}\\b(?:huyet ap|blood pressure|duong huyet|nhip tim|heart rate|can nang|chieu cao|bmi|hba1c|cholesterol|ldl|hdl|triglycerid\\w*|creatinine)\\b[^.!?\\n]{0,25}\\d`,
  "i",
);
const COMMON_MODE_THERAPY_PATTERN = new RegExp(
  `\\b${COMMON_MODE_SUBJECT_SOURCE}\\b[^.!?\\n]{0,80}\\b(?:uong|dung|su dung|tiem|xai|boi|dan|xit|taking|takes?|uses?|using|apply|applies|applied|inject\\w*)\\b[^.!?\\n]{0,20}\\b(?:thuoc|medication|medicine|pills?|drugs?|vien|gel|cao|kem|salonpas|paracetamol|acetaminophen|voltaren|diclofenac|ibuprofen|aspirin|panadol|efferalgan|tylenol|naproxen|amoxicillin|antibiotics?|khang sinh|corticoid|steroids?|opioids?|morphin\\w*|tramadol|insulin)\\b`,
  "i",
);
// Ngày sinh (nhãn hoặc ngày đầy đủ) đi cùng một khẳng định bệnh là định danh + sức khỏe.
const COMMON_MODE_BIRTH_PATTERN = new RegExp(
  `\\b(?:sinh ngay|sinh nam|ngay sinh|nam sinh|sinh nhat|born|dob|date of birth|birthday)\\b|\\b(?:0?[1-9]|[12]\\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\\d{2}\\b`,
  "i",
);
const NAME_INTRODUCTION_PATTERN =
  /\b(?:ten la|ten toi la|ho ten|goi la|biet danh|(?:khach hang|hoc vien|benh nhan|client|patient)\s+(?:ten|named))\b/;
const CLINICIAN_DIAGNOSED_PERSON_PATTERN =
  /\b(?:bac si|doctor|clinician|physician)\b[^.!?\n]{0,30}\b(?:chan doan|diagnos\w*)\b[^.!?\n]{0,20}\b(?:toi|minh|em|me)\b/;

// Chủ thể gồm từ tiếng Việt có dấu ("việc tự ý giãn") là cụm câu thông thường, không phải tên giữ chỗ không dấu.
const subjectIsVietnamesePhrase = (value, subject) => {
  const subjectTokens = String(subject || "").split(" ").filter(Boolean);
  if (subjectTokens.length < 4) return false;
  const words = [...String(value || "").matchAll(/[\p{L}\p{M}\p{N}_'’-]+/gu)].map((match) => match[0]);
  const normalizedWords = words.map((word) => normalizeHealthText(word));
  for (let start = 0; start + subjectTokens.length <= words.length; start += 1) {
    if (subjectTokens.every((token, offset) => normalizedWords[start + offset] === token)) {
      return words
        .slice(start, start + subjectTokens.length)
        .some((word) => VIETNAMESE_DIACRITIC_PATTERN.test(word));
    }
  }
  return false;
};
// "mình" (đại từ, có dấu) khác tên riêng "Minh": chỉ coi là đại từ khi văn bản có chữ "mình".
const isNonPersonHealthSubject = (value, subject) =>
  subject === "minh"
    ? /(?<![\p{L}])mình(?![\p{L}])/iu.test(String(value || ""))
    : NON_PERSON_HEALTH_SUBJECT_PATTERN.test(subject);
const NON_PERSON_HEALTH_SUBJECT_PATTERN =
  /^(?:(?:toi|em|tui|chung toi|i)|(?:tap|bai tap|squat|deadlift|bench|press|plank|cardio|gym|chay|boi|yoga|pilates|hiit|co bap|co the|tinh trang|he_thong|viec|benh|can nang|che do|luong|muc|nhom|vung)\b.*|.*\b(?:khach hang|hoc vien|benh nhan|nguoi tap|nguoi moi|nguoi lon tuoi|nguoi cao tuoi|nguoi|clients?|patients?|customers?|members?|users?|trainees?))$/;
const HEALTH_ASSERTION_SUBJECT_TOKEN_SOURCE =
  "(?!(?:who|that|bi|mac|co|has|have|had|was|is|are|were|diagnosed|injured|suffers?)\\b)[a-z][a-z0-9_'-]*";
const EMBEDDED_NAMED_PERSON_HEALTH_ASSERTION_PATTERN = new RegExp(
  `\\b(${HEALTH_ASSERTION_SUBJECT_TOKEN_SOURCE}(?:\\s+${HEALTH_ASSERTION_SUBJECT_TOKEN_SOURCE}){0,5})\\s+(?:(?:who|that)\\s+)?(?:bi|mac|co|has|have|had|suffers? from|injured|(?:(?:was|is|are|were)\\s+)?diagnosed(?:\\s+with)?)\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "gi",
);
const GENERIC_HEALTH_ASSERTION_SUBJECT_SUFFIX_PATTERN =
  /(?:^|\s)(?:tre em|children|nguoi|people|persons?|individuals?|adults?|men|women|athletes?|beginners?|seniors?|patients?|clients?|customers?|members?|users?|who|that|research|studies?|evidence|guidance|training|exercise|fitness|nutrition|disease|condition)$/i;
const FITNESS_RECIPIENT_HEALTH_ASSERTION_PATTERN = new RegExp(
  `\\b(?:exercise|fitness|workout|training|cardio|squat|tap|bai tap|lich tap|advice|guidance|recommendations?)\\b[\\s\\S]{0,80}\\b(?:for|cho)\\s+(?:[a-z][a-z0-9_'-]*\\s+){1,3}(?:(?:who|that)\\s+)?(?:bi|mac|co|with|has|have|had|suffers? from)\\s+(?:${MEDICAL_CONDITION_SOURCE})\\b`,
  "i",
);
const PRIVATE_RELATION_HEALTH_ASSERTION_PATTERN = new RegExp(
  `\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,5}\\s+(?:(?:who|that)\\s+)?(?:with|is|was|has|have|had|tore(?:\\s+(?:his|her|their))?)\\b(?:\\s+[a-z0-9_/-]+){0,8}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
const FIRST_PERSON_DIAGNOSIS_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+(?:(?:dang|vua|da|moi|tung)\\s+){0,2}(?:duoc\\s+)?(?:chan doan|xac nhan|ket luan)(?:\\s+(?:la|mac|bi))?\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
const PRIVATE_RECORD_DIAGNOSIS_PATTERN = new RegExp(
  `\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,5}\\s+(?:(?:dang|vua|da|moi|tung)\\s+){0,2}(?:duoc\\s+)?(?:chan doan|xac nhan|ket luan)(?:\\s+(?:la|mac|bi))?\\b(?:\\s+[a-z0-9_/-]+){0,12}\\s+\\b${MEDICAL_CONDITION_SOURCE}\\b`,
  "i",
);
const FIRST_PERSON_CLINICAL_EVENT_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+(?:(?:dang|vua|da|moi|tung|duoc|se|muon|am|going to|plan to)\\s+){0,3}(?:mo|phau thuat|dieu tri|uong thuoc|dung thuoc|mang thai|muon tu tu|tu tu|tu sat|tu hai|ket lieu|end my life|take my life|kho tho|ngat xiu|dau nguc)\\b`,
  "i",
);
const FIRST_PERSON_DIRECT_SYMPTOM_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+(?:(?:dang|vua|da|moi|tung|cam thay)\\s+){0,2}(?:(?:bi\\s+)?dau(?:\\s+(?:nguc|khop_goi|lung|vai|co|bung|hong|chan|tay))?|(?:bi\\s+)?chan thuong(?:\\s+[a-z0-9_/-]+){0,4}|(?:bi\\s+)?sot(?!\\s+ruot\\b)|co giat|kho tho|ngat xiu)\\b`,
  "i",
);
const PRIVATE_RECORD_CLINICAL_EVENT_PATTERN = new RegExp(
  `\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,5}\\s+(?:(?:dang|vua|da|moi|just|is|was)\\s+){0,2}(?:dau nguc|kho tho|ngat xiu|dot quy|co giat|sot(?!\\s+ruot\\b)|muon tu tu|tu hai|chest pain|shortness of breath|faint(?:ed|ing)?|stroke|seizure|fever|(?:having\\s+(?:a\\s+)?)?heart attack|suicidal|self harm)\\b`,
  "i",
);
const ENGLISH_PERSONAL_HEALTH_PATTERN =
  /\b(?:i|he|she|they|client|patient|customer|member|user)\b\s+(?:(?:am|is|are|was|were|just|has been|have been)\s+){0,2}(?:have|has|had|was diagnosed|is diagnosed|are diagnosed|suffer(?:s)? from|underwent|taking|am pregnant|is pregnant|are pregnant|injured|in pain|suicidal|diabetic)\b/i;
// Unknown condition/medication names cannot be exhaustively enumerated. A
// private person's assertion followed by a fitness/health-advice request is
// treated conservatively before routing or any external retrieval sink.
const STRUCTURAL_PRIVATE_ASSERTION_VERB_SOURCE =
  "(?:have|has|had|take|takes|taking|use|uses|using|diagnosed with|suffer(?:s)? from|bi|mac|co|uong|su dung|dung)";
const STRUCTURAL_PRIVATE_ASSERTION_PATTERN = new RegExp(
  `\\b(?:(?:${FIRST_PERSON_SUBJECT_SOURCE}|i)\\s+${STRUCTURAL_PRIVATE_ASSERTION_VERB_SOURCE}|${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,3}\\s+${STRUCTURAL_PRIVATE_ASSERTION_VERB_SOURCE})\\s+((?:(?:a|an|the|mot)\\s+)?[a-z][a-z0-9_/-]*(?:\\s+[a-z][a-z0-9_/-]*){0,2})`,
  "gi",
);
const STRUCTURAL_PRIVATE_TREATMENT_PATTERN =
  /\b(?:(?:my|our)\s+(?:doctor|clinician|physician)\s+(?:(?:put|placed|started)\s+(?:me|us)\s+on|prescribed\s+(?:me|us))|i\s+(?:am|was)\s+allergic\s+to)\s+((?:(?:a|an|the)\s+)?[a-z][a-z0-9_/-]*(?:\s+[a-z][a-z0-9_/-]*){0,2})/gi;
const STRUCTURAL_PRIVATE_ON_TREATMENT_PATTERN = new RegExp(
  `\\b(?:i|${FIRST_PERSON_SUBJECT_SOURCE}|${PRIVATE_RECORD_SUBJECT_SOURCE})\\b(?:\\s+[a-z0-9_'-]+){0,3}\\s+(?:am|m|is|are|was|were|dang)\\s+on\\s+((?:(?:a|an|the|mot)\\s+)?[a-z][a-z0-9_/-]*(?:\\s+[a-z][a-z0-9_/-]*){0,2})`,
  "gi",
);
const STRUCTURAL_NAMED_RECIPIENT_ASSERTION_PATTERN =
  /\b(?:exercise|fitness|workout|training|cardio|squat|tap|bai tap|lich tap|advice|guidance|recommendations?)\b[\s\S]{0,80}\b(?:for|cho)\s+(?:[a-z][a-z0-9_'-]*\s+){1,3}(?:(?:who|that)\s+)?(?:has|have|had|with|bi|mac|co)\s+((?:(?:a|an|the|mot)\s+)?[a-z][a-z0-9_/-]*(?:\s+[a-z][a-z0-9_/-]*){0,2})/gi;
const PRIVATE_ADVICE_CONTEXT_PATTERN =
  /\b(?:exercise|fitness|workout|training|cardio|squat|tap|bai tap|lich tap|the hinh|health|medical|treatment|advice|guidance|recommendations?|research|studies|sources?|current|latest|recently|changed)\b/i;
const BENIGN_ASSERTION_OBJECT_PATTERN =
  /^(?:(?:a|an|the|mot|chiec|cai)\s+)?(?:doi ta (?:don|tay)|day khang luc|question|thac mac|cau hoi|time|thoi gian|dumbbells?|barbell|weights?|bands?|resistance|treadmill|home gym|gym|belt|straps?|lifting straps?|walk|creatine|protein|whey|pre[- ]workout|coach|trainer|(?:new\s+)?training(?:\s+(?:program|plan))?|workout(?:\s+(?:app|plan))?|app|phone|computer|idea|plan|dai lung|muc ta|thanh don|tempo|google|strava|may chay|ta don|ta tay|set\d+|neutral_oil|neutral_head|neutral_hospital|vacation|holiday|bus|train|my way|track)\b/i;
const DIRECT_SELF_HARM_DISCLOSURE_PATTERN =
  /\b(?:toi|minh|em|tui|ban toi|i|my friend)\b\s+(?:(?:dang|vua|se|muon|co the|am|is|are|want to|going to|plan to|might)\s+){0,4}(?:tu tu|tu sat|tu hai|ket lieu|muon chet|kill myself|hurt myself|end my life|take my life|want to die|self harm|overdose(?: myself)?|do not want to live(?: anymore)?)\b/i;
// Triệu chứng cấp hoặc có số đo gắn với bản thân vẫn bị chặn khi cho phép nêu bệnh thông thường.
const ACUTE_OR_MEASURED_PERSONAL_PATTERN =
  /\b(?:toi|minh|em|tui|chung toi|i|my|me|khach hang|hoc vien|benh nhan|clients?|patients?)\b[^.!?\n]{0,40}\b(?:dau nguc|dau that nguc|tuc nguc|kho tho|ngat|choang vang|dot quy|co giat|dau tim|dau neutral_head du doi|chest pain|faint(?:ed|ing)?)\b|\b(?:sot|fever|nhiet do|temperature)\b[^.!?\n]{0,16}\b\d{2}(?:[.,]\d)?\b/i;
const ENGLISH_DIRECT_SYMPTOM_PATTERN =
  /\bi\b\s+(?:(?:am|was|just|have|had|feel|felt)\s+){0,3}(?:chest pain|short of breath|shortness of breath|cannot breathe|can t breathe|faint(?:ed|ing)?|had a stroke)\b/i;
const IMMINENT_FAINT_DISCLOSURE_PATTERN =
  /\bi\s+(?:feel|felt|am)\s+dizzy(?:\s+and)?\s+(?:i\s+)?(?:am\s+)?about to faint\b|\b(?:toi|minh|em)\s+(?:cam thay\s+)?chong mat\s+va\s+sap ngat\b/i;
const NON_MEDICAL_STROKE_PATTERN =
  /\b(?:freestyle|swimming|swim|golf|tennis|rowing)\s+stroke\b|\bstroke\s+(?:technique|form|rate)\b/gi;
const EDUCATIONAL_HEALTH_QUERY_INTRO_PATTERN = new RegExp(
  `\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+co\\s+(?:cau hoi|thac mac)(?:\\s+(?:ve|lien quan den))?\\b`,
  "gi",
);
const POSSESSED_HEALTH_PATTERN = new RegExp(
  `(?:\\bmy\\s+${MEDICAL_CONDITION_SOURCE}\\b|\\b${MEDICAL_CONDITION_SOURCE}\\s+(?:cua toi|cua minh)\\b)`,
  "i",
);
const PRIVATE_RECORD_CLINICAL_DATA_PATTERN = new RegExp(
  `\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b[\\s\\S]{0,120}\\b${CLINICAL_RECORD_SOURCE}\\b`,
  "i",
);
const FIRST_PERSON_CLINICAL_VALUE_PATTERN = new RegExp(
  `(?:\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b[\\s\\S]{0,80}\\b${CLINICAL_RECORD_SOURCE}\\b[\\s:=/-]{0,12}\\d|\\b(?:cua toi|cua minh|my|mine)\\b\\s+\\b${CLINICAL_RECORD_SOURCE}\\b[\\s\\S]{0,20}\\d|\\b${CLINICAL_RECORD_SOURCE}\\b[\\s\\S]{0,60}\\b(?:cua toi|cua minh|my|mine)\\b)`,
  "i",
);
const FIRST_PERSON_CLINICAL_STATUS_PATTERN = new RegExp(
  `(?:\\bmy\\s+${CLINICAL_RECORD_SOURCE}\\b|\\b${CLINICAL_RECORD_SOURCE}\\s+(?:cua toi|cua minh)\\b)\\s+(?:(?:is|was|dang|la|o muc)\\s+){0,2}(?:high|low|elevated|abnormal|cao|thap|bat thuong)\\b`,
  "i",
);
const OPTIONAL_OBJECT_CLASSIFIER_SOURCE = "(?:(?:a|an|the|mot|chiec|cai)\\s+)?";
const PERSONAL_TREATMENT_ACTION_PATTERN = new RegExp(
  `\\b(?:${FIRST_PERSON_SUBJECT_SOURCE}|${PRIVATE_RECORD_SUBJECT_SOURCE}|i|my)\\b[\\s\\S]{0,120}\\b(?:uong|dung|su dung|xai|tiem|taking|takes?|uses?|using|inject(?:s|ed|ing)?|prescrib(?:e|es|ed|ing)|receiv(?:e|es|ed|ing)|undergoing|duoc dieu tri|dieu tri bang|duoc ke|duoc cho|am on|is on|are on|was on|was given|were given|has been prescribed|have been prescribed)\\b\\s+${OPTIONAL_OBJECT_CLASSIFIER_SOURCE}${CLINICAL_TREATMENT_SOURCE}\\b`,
  "i",
);
const CLINICIAN_PRESCRIBED_PERSONAL_PATTERN =
  /(?:\b(?:doctor|clinician|physician|bac si)\b[\s\S]{0,60}\b(?:prescrib(?:e|es|ed|ing)|gave|give|gives|ke|cho dung)\b[\s\S]{0,40}\b(?:me|toi|minh|em)\b|\b(?:i|toi|minh|em)\b[\s\S]{0,40}\b(?:doctor|clinician|physician|bac si)\b[\s\S]{0,40}\b(?:prescrib(?:e|es|ed|ing)|gave|give|gives|ke|cho dung)\b)/i;

const PRIVATE_CLINICAL_SUBJECT_PATTERN = new RegExp(
  `\\b(?:${FIRST_PERSON_SUBJECT_SOURCE}|${PRIVATE_RECORD_SUBJECT_SOURCE}|i|my)\\b`,
  "gi",
);
const STRUCTURED_ALPHANUMERIC_METRIC_PATTERN =
  /\b(?!(?:set|rep|rpe|rir|zone|week|day|pace|speed)\d\b)[a-z]{2,20}\d[a-z0-9_-]{0,16}\b[\s\S]{0,100}?\b\d+(?:[.,]\d+)?(?:\s*%)?/gi;
const STRONG_CLINICAL_UNIT_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:mg\/?dl|mmol\/?l|ng\/?ml|g\/?dl|ml\/?kg\/?min|ml\/?min|mmhg|bpm|iu\/?l|u\/?l|meq\/?l|umol\/?l)\b/gi;
const KNOWN_CLINICAL_VALUE_PATTERN = new RegExp(
  `\\b${CLINICAL_RECORD_SOURCE}\\b[\\s\\S]{0,100}?\\b\\d+(?:[.,]\\d+)?`,
  "gi",
);
const NUMERIC_CALENDAR_DATE_SOURCE =
  "(?:(?:0?[1-9]|[12]\\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:19|20)\\d{2}|(?:19|20)\\d{2}[/.-](?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\\d|3[01]))";
const DATE_OF_BIRTH_LABEL_PATTERN = new RegExp(
  `\\b(?:ngay sinh|date of birth|dob)\\b[\\s\\S]{0,80}?\\b${NUMERIC_CALENDAR_DATE_SOURCE}\\b`,
  "i",
);
const PERSONAL_DATE_OF_BIRTH_PATTERN = new RegExp(
  `(?:\\b${FIRST_PERSON_SUBJECT_SOURCE}\\b\\s+(?:(?:da|duoc)\\s+)?sinh(?:\\s+(?:vao\\s+)?ngay)?\\s+${NUMERIC_CALENDAR_DATE_SOURCE}\\b|\\bi\\b\\s+(?:(?:was|am)\\s+)?born(?:\\s+on)?\\s+${NUMERIC_CALENDAR_DATE_SOURCE}\\b|\\b${PRIVATE_RECORD_SUBJECT_SOURCE}\\b(?:\\s+[a-z0-9_'-]+){0,5}\\s+(?:sinh(?:\\s+(?:vao\\s+)?ngay)?|(?:was\\s+)?born(?:\\s+on)?)\\s+${NUMERIC_CALENDAR_DATE_SOURCE}\\b)`,
  "i",
);
const GENERIC_SUBJECT_DATE_OF_BIRTH_PATTERN = new RegExp(
  `\\b[a-z][a-z0-9_'-]{0,80}\\s+(?:(?:was\\s+)?born(?:\\s+on)?|sinh(?:\\s+(?:vao\\s+)?ngay))\\s+${NUMERIC_CALENDAR_DATE_SOURCE}\\b`,
  "i",
);

const normalizeHealthText = (value, { preserveClausePunctuation = false } = {}) =>
  maskVietnameseGeneralPhrases(value)
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("trẻ em", "children")
    .replaceAll("bệnh viện", "neutral_hospital")
    .replaceAll("dầu", "neutral_oil")
    .replaceAll("bắt đầu", "khoi_dau")
    .replaceAll("ban đầu", "luc_dau")
    .replaceAll("lúc đầu", "luc_dau")
    .replaceAll("đầu tiên", "thu_nhat")
    .replaceAll("đầu gối", "khop_goi")
    .replaceAll("đầu", "neutral_head")
    .replace(/(?<![\p{L}])hệ(?![\p{L}])/gu, "he_thong")
    .replaceAll("thi đấu", "thi_dau")
    .replaceAll("ở đâu", "vi_tri")
    .replaceAll("đậu", preserveClausePunctuation ? "neutral_bean" : "đậu")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(preserveClausePunctuation ? /[^a-z0-9\s_/.,;!?-]/g : /[^a-z0-9\s_/-]/g, " ")
    .replace(/\b(?:bat dau|ban dau|luc dau|dau tien|o dau|thi dau)\b/g, "neutral_phrase")
    .replace(/\s+/g, " ")
    .trim();

const normalizeClinicalStructureText = (value) =>
  maskVietnameseGeneralPhrases(value)
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s_%.,:/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const maskNonMedicalStrokePhrases = (value) =>
  String(value || "").replace(NON_MEDICAL_STROKE_PATTERN, "non_medical_stroke");

const maskEducationalHealthQueryIntro = (value) =>
  String(value || "").replace(
    EDUCATIONAL_HEALTH_QUERY_INTRO_PATTERN,
    "educational_health_query",
  );

const HEALTH_CLAUSE_SEPARATOR_PATTERN =
  /(?:[.!?;,:|/]+|\s*[–—]\s*|\s+-\s+|\s+(?:and|but|và|nhưng)\s+)/iu;

export const splitHealthClauses = (value) =>
  String(value || "")
    .split(HEALTH_CLAUSE_SEPARATOR_PATTERN)
    .map((clause) => clause.trim())
    .filter(Boolean);

export function extractNamedPersonalHealthSubjects(value) {
  const subjects = new Set();
  for (const clause of splitHealthClauses(value)) {
    const normalized = maskEducationalHealthQueryIntro(
      normalizeHealthText(clause),
    );
    for (const match of normalized.matchAll(
      EMBEDDED_NAMED_PERSON_HEALTH_ASSERTION_PATTERN,
    )) {
      const subject = String(match[1] || "").trim();
      if (
        subject &&
        !GENERIC_HEALTH_ASSERTION_SUBJECT_SUFFIX_PATTERN.test(subject)
      ) {
        subjects.add(subject);
      }
    }
  }
  return [...subjects];
}

const containsNamedPersonHealthAssertion = (value) =>
  splitHealthClauses(value).some((clause) =>
    NAMED_PERSON_HEALTH_ASSERTION_PATTERN.test(
      maskEducationalHealthQueryIntro(normalizeHealthText(clause)),
    ),
  );

const collectMatchRanges = (value, pattern) =>
  [...String(value || "").matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));

const rangesAreNearby = (left, right, maximumGap = 160) => {
  const gap = Math.max(
    0,
    Math.max(left.start, right.start) - Math.min(left.end, right.end),
  );
  return gap <= maximumGap;
};

const containsPrivateStructuredClinicalValue = (value) => {
  const subjects = collectMatchRanges(value, PRIVATE_CLINICAL_SUBJECT_PATTERN);
  if (subjects.length === 0) return false;
  const signals = [
    ...collectMatchRanges(value, STRUCTURED_ALPHANUMERIC_METRIC_PATTERN),
    ...collectMatchRanges(value, STRONG_CLINICAL_UNIT_PATTERN),
    ...collectMatchRanges(value, KNOWN_CLINICAL_VALUE_PATTERN),
  ];
  return subjects.some((subject) =>
    signals.some((signal) => rangesAreNearby(subject, signal)),
  );
};

// Equipment does not exempt a later symptom with an inherited subject. Keep
// clause punctuation for this check; the ordinary health normalizer removes it.
const INHERITED_PRIVATE_ASSERTION_PATTERN = new RegExp(
  `(?:\\b(?:va|nhung|and|but)|[,;])\\s*(?:(?:dang|van|vua|da|thuong|hay|lai|currently|still|also|recently|now)\\s+){0,4}(?:${STRUCTURAL_PRIVATE_ASSERTION_VERB_SOURCE}|cam thay|feel(?:ing)?|am injured|dau(?!\\s+(?:phong|nanh|phu|que)\\b)|nhuc)\\b\\s*(?=([a-z][a-z0-9_/-]*(?:\\s+[a-z][a-z0-9_/-]*){0,2}))`,
  "gi",
);
const INHERITED_PRIVATE_SUBJECT_PATTERN = new RegExp(
  `\\b(?:${FIRST_PERSON_SUBJECT_SOURCE}|${PRIVATE_RECORD_SUBJECT_SOURCE}|i)\\b[^.!?\\n]*$`, "i",
);
const containsInheritedPrivateHealthAssertion = (value) => {
  for (const match of value.matchAll(INHERITED_PRIVATE_ASSERTION_PATTERN)) {
    const prefix = value.slice(Math.max(0, match.index - 120), match.index);
    if (INHERITED_PRIVATE_SUBJECT_PATTERN.test(prefix) &&
        !BENIGN_ASSERTION_OBJECT_PATTERN.test(match[1])) return true;
  }
  return false;
};

// Chỉ bỏ qua khi chủ ngữ là ngôi thứ nhất hoặc vai trò chung; người thân (my friend/son...) vẫn bị chặn.
// Tên thuốc cụ thể (không tính chữ "thuốc" chung chung) vẫn là dữ liệu cần chặn.
const NAMED_DRUG_PATTERN = new RegExp(
  `\\b${CLINICAL_TREATMENT_SOURCE.replace("|medication|medicine|prescription|thuoc)", ")")}\\b`,
  "i",
);
const GENERIC_MEDICATION_WORD_PATTERN = /\b(?:thuoc|medication|medicine|prescription)\b/g;
const COMMON_CONDITION_SUBJECT_PATTERN =
  /^(?:toi|minh|em|tui|chung toi|i|khach hang|hoc vien|benh nhan|nguoi|clients?|patients?|customers?|members?|users?|trainees?)\b/;
const GENERIC_RECIPIENT_PATTERN =
  /(?:for|cho)\s+(?:nguoi|people|persons?|adults?|those|clients?|khach hang|hoc vien|benh nhan|patients?|athletes?|beginners?|seniors?|trainees?)\b/;
const CONDITION_ASSERTION_VERB_PATTERN =
  /\b(?:bi|mac|co|have|has|had|diagnosed with|suffer(?:s)? from)\s*$/;

const containsUnlistedPrivateHealthAssertion = (value, { allowCommonConditions = false } = {}) => {
  for (const match of value.matchAll(STRUCTURAL_PRIVATE_TREATMENT_PATTERN)) {
    const object = String(match[1] || "").trim();
    if (object && !BENIGN_ASSERTION_OBJECT_PATTERN.test(object)) return true;
  }
  for (const match of value.matchAll(STRUCTURAL_PRIVATE_ON_TREATMENT_PATTERN)) {
    const object = String(match[1] || "").trim();
    if (object && !BENIGN_ASSERTION_OBJECT_PATTERN.test(object)) return true;
  }
  for (const match of value.matchAll(
    STRUCTURAL_NAMED_RECIPIENT_ASSERTION_PATTERN,
  )) {
    const object = String(match[1] || "").trim();
    if (allowCommonConditions && GENERIC_RECIPIENT_PATTERN.test(match[0])) continue;
    if (object && !BENIGN_ASSERTION_OBJECT_PATTERN.test(object)) return true;
  }
  if (!PRIVATE_ADVICE_CONTEXT_PATTERN.test(value)) return false;
  for (const match of value.matchAll(STRUCTURAL_PRIVATE_ASSERTION_PATTERN)) {
    const object = String(match[1] || "").trim();
    if (allowCommonConditions) {
      const beforeObject = match[0].slice(0, Math.max(0, match[0].indexOf(object))).trim();
      if (
        CONDITION_ASSERTION_VERB_PATTERN.test(beforeObject) &&
        COMMON_CONDITION_SUBJECT_PATTERN.test(beforeObject)
      ) {
        continue;
      }
    }
    if (object && !BENIGN_ASSERTION_OBJECT_PATTERN.test(object)) return true;
  }
  return false;
};

export function containsHealthInformation(value) {
  return HEALTH_INFORMATION_PATTERN.test(normalizeHealthText(value));
}

export function containsDateOfBirthInformation(value) {
  const normalized = normalizeClinicalStructureText(value);
  return (
    DATE_OF_BIRTH_LABEL_PATTERN.test(normalized) ||
    PERSONAL_DATE_OF_BIRTH_PATTERN.test(normalized) ||
    GENERIC_SUBJECT_DATE_OF_BIRTH_PATTERN.test(normalized)
  );
}

/**
 * Nhận diện disclosure sức khỏe cá nhân bằng subject + assertion/event thay vì
 * chỉ dựa vào danh sách một số tên bệnh. Không trả raw text hoặc chi tiết match.
 */
export function containsPersonalHealthData(value, { allowCommonConditions = false } = {}) {
  const normalized = maskNonMedicalStrokePhrases(normalizeHealthText(value));
  const assertionText = maskEducationalHealthQueryIntro(normalized);
  const assertionClauses = maskEducationalHealthQueryIntro(maskNonMedicalStrokePhrases(
    normalizeHealthText(value, { preserveClausePunctuation: true }),
  ));
  const clinicalStructure = normalizeClinicalStructureText(value);
  // Khi cho phép nêu bệnh thông thường, chữ "thuốc" chung chung không phải tên thuốc; tên thuốc cụ thể vẫn bị chặn.
  const treatmentText =
    allowCommonConditions && !NAMED_DRUG_PATTERN.test(normalized)
      ? normalized.replace(GENERIC_MEDICATION_WORD_PATTERN, "generic_med")
      : normalized;
  if (!normalized) return false;
  if (
    DATE_OF_BIRTH_LABEL_PATTERN.test(clinicalStructure) ||
    PERSONAL_DATE_OF_BIRTH_PATTERN.test(clinicalStructure) ||
    GENERIC_SUBJECT_DATE_OF_BIRTH_PATTERN.test(clinicalStructure)
  ) {
    return true;
  }
  if (DIRECT_SELF_HARM_DISCLOSURE_PATTERN.test(normalized)) return true;
  if (
    (!allowCommonConditions && PRIVATE_RECORD_CLINICAL_DATA_PATTERN.test(normalized)) ||
    FIRST_PERSON_CLINICAL_VALUE_PATTERN.test(normalized) ||
    FIRST_PERSON_CLINICAL_STATUS_PATTERN.test(normalized) ||
    PERSONAL_TREATMENT_ACTION_PATTERN.test(treatmentText) ||
    CLINICIAN_PRESCRIBED_PERSONAL_PATTERN.test(treatmentText) ||
    (!allowCommonConditions && containsInheritedPrivateHealthAssertion(assertionClauses)) ||
    containsUnlistedPrivateHealthAssertion(assertionText, { allowCommonConditions }) ||
    containsPrivateStructuredClinicalValue(clinicalStructure)
  ) {
    return true;
  }
  if (!HEALTH_INFORMATION_PATTERN.test(normalized)) return false;

  if (allowCommonConditions) {
    // Nêu một bệnh/triệu chứng thông thường không kèm danh tính, số đo hay thuốc thì không phải dữ liệu cần chặn.
    // Vẫn chặn: chủ thể có tên riêng, biến cố lâm sàng (phẫu thuật, điều trị, ngất, đau ngực...) và triệu chứng cấp.
    const genericAssertion = assertionText.replace(GENERIC_ROLE_SUBJECT_PATTERN, "generic_role");
    return (
      extractNamedPersonalHealthSubjects(value).some(
        (subject) =>
          !isNonPersonHealthSubject(value, subject) &&
          !subjectIsVietnamesePhrase(value, subject),
      ) ||
      CLINICIAN_DIAGNOSED_PERSON_PATTERN.test(assertionText) ||
      RELATIVE_OF_SELF_PATTERN.test(assertionText) ||
      SELF_DIAGNOSIS_PATTERN.test(assertionText) ||
      COMMON_MODE_SENSITIVE_PATTERN.test(assertionText) ||
      COMMON_MODE_MEASURED_PATTERN.test(assertionText) ||
      COMMON_MODE_THERAPY_PATTERN.test(assertionText) ||
      NAME_INTRODUCTION_PATTERN.test(assertionText) ||
      COMMON_MODE_BIRTH_PATTERN.test(assertionText) ||
      PRIVATE_RELATION_HEALTH_ASSERTION_PATTERN.test(assertionText) ||
      FIRST_PERSON_DIAGNOSIS_PATTERN.test(assertionText) ||
      PRIVATE_RECORD_DIAGNOSIS_PATTERN.test(assertionText) ||
      FIRST_PERSON_CLINICAL_EVENT_PATTERN.test(genericAssertion) ||
      PRIVATE_RECORD_CLINICAL_EVENT_PATTERN.test(assertionText) ||
      ACUTE_OR_MEASURED_PERSONAL_PATTERN.test(assertionText) ||
      ENGLISH_DIRECT_SYMPTOM_PATTERN.test(assertionText) ||
      IMMINENT_FAINT_DISCLOSURE_PATTERN.test(assertionText)
    );
  }

  return (
    extractNamedPersonalHealthSubjects(value).length > 0 ||
    FIRST_PERSON_HEALTH_ASSERTION_PATTERN.test(assertionText) ||
    PRIVATE_RECORD_HEALTH_ASSERTION_PATTERN.test(assertionText) ||
    containsNamedPersonHealthAssertion(value) ||
    FITNESS_RECIPIENT_HEALTH_ASSERTION_PATTERN.test(assertionText) ||
    PRIVATE_RELATION_HEALTH_ASSERTION_PATTERN.test(assertionText) ||
    FIRST_PERSON_DIAGNOSIS_PATTERN.test(assertionText) ||
    PRIVATE_RECORD_DIAGNOSIS_PATTERN.test(assertionText) ||
    FIRST_PERSON_CLINICAL_EVENT_PATTERN.test(assertionText) ||
    FIRST_PERSON_DIRECT_SYMPTOM_PATTERN.test(assertionText) ||
    PRIVATE_RECORD_CLINICAL_EVENT_PATTERN.test(assertionText) ||
    ENGLISH_PERSONAL_HEALTH_PATTERN.test(assertionText) ||
    ENGLISH_DIRECT_SYMPTOM_PATTERN.test(assertionText) ||
    IMMINENT_FAINT_DISCLOSURE_PATTERN.test(assertionText) ||
    POSSESSED_HEALTH_PATTERN.test(assertionText)
  );
}
