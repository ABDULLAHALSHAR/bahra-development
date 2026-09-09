/************************************************************
 *  منصة بحرة إلكتريك لتطوير الموظفين — الباك-إند (Apps Script)
 *  الوظائف:
 *   1) مساعد «اسألني» عبر Groq API   (action: "ask")
 *   2) قراءة/كتابة البيانات من Google Sheets
 *      (employees / courses / requests)
 *
 *  الإعداد السريع:
 *   - Extensions ▸ Apps Script ، الصق هذا الملف.
 *   - Project Settings ▸ Script Properties: أضف مفتاح
 *       GROQ_KEY  =  مفتاح Groq الخاص بك (يبدأ بـ gsk_...)
 *   - Deploy ▸ New deployment ▸ Web app
 *       Execute as: Me   |   Who has access: Anyone
 *   - انسخ رابط الـ Web App والصقه في index.html داخل CONFIG.API_URL
 ************************************************************/

var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
var GROQ_MODEL = 'llama-3.3-70b-versatile';

/* نقطة استقبال طلبات المتصفح (POST) */
function doPost(e) {
  var out = { ok: false };
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    switch (req.action) {
      case 'ask':         out = askAI(req.q, req.lang, req.context); break;
      case 'employees':   out = { ok: true, data: readSheet('employees') }; break;
      case 'courses':     out = { ok: true, data: readSheet('courses') };   break;
      case 'requests':    out = { ok: true, data: readSheet('requests') };  break;
      case 'addRequest':  out = addRequest(req.row); break;
      default:            out = { ok: false, error: 'unknown action' };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return json(out);
}

/* فحص سريع أن الخدمة تعمل (افتح الرابط في المتصفح) */
function doGet() {
  return json({ ok: true, service: 'Bahra Employee Development API', time: new Date() });
}

/* ============ 1) مساعد «اسألني» عبر Groq ============ */
function askAI(question, lang, context) {
  var key = PropertiesService.getScriptProperties().getProperty('GROQ_KEY');
  if (!key) return { ok: false, reply: 'لم يتم ضبط مفتاح GROQ_KEY في إعدادات المشروع.' };

  var sys = (lang === 'en')
    ? 'You are "Ask-Me", the smart assistant of Bahra Electric\'s Employee Development Platform. '
      + 'Answer briefly and helpfully about training needs, courses, sessions and development, '
      + 'using ONLY the context provided. Answer in English.'
    : 'أنت «اسألني»، المساعد الذكي لمنصة بحرة إلكتريك لتطوير الموظفين. '
      + 'أجب باختصار وفائدة عن الاحتياج التدريبي والدورات والجلسات والتطوير المهني '
      + 'اعتماداً على السياق المرفق فقط. أجب باللغة العربية.';

  var payload = {
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: 'system', content: sys + '\n\nالسياق:\n' + (context || '') },
      { role: 'user',   content: question || '' }
    ]
  };

  var res = UrlFetchApp.fetch(GROQ_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  var reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : (data.error ? data.error.message : 'تعذّر الحصول على رد.');
  return { ok: true, reply: reply };
}

/* ============ 2) Google Sheets ============ */
/* تُقرأ البيانات من التبويب المطلوب: الصف الأول عناوين الأعمدة */
function readSheet(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  return values.slice(1).map(function (row) {
    var o = {};
    head.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

/* إضافة طلب تدريب جديد إلى تبويب requests */
function addRequest(row) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('requests');
  if (!sh) return { ok: false, error: 'sheet "requests" not found' };
  sh.appendRow([ row.id || ('r' + Date.now()), row.emp, row.course, row.date, row.status || 'review' ]);
  return { ok: true };
}

/* مخرجات JSON */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
