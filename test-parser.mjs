import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '_text',
  trimValues: true,
});

function unescapeXml(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseAADEResponse(xmlStr) {
  if (!xmlStr || typeof xmlStr !== 'string') return { success: false, errors: ['Empty response'] };

  try {
    const json = JSON.parse(xmlStr);
    if (json.message || json.statusCode) {
      return { success: false, errors: [json.message || ('HTTP ' + json.statusCode)], statusCode: String(json.statusCode) };
    }
  } catch {}

  let parsed = parser.parse(xmlStr);

  if (parsed.string) {
    if (typeof parsed.string === 'string') {
      parsed = parser.parse(unescapeXml(parsed.string));
    } else if (parsed.string._text && typeof parsed.string._text === 'string') {
      parsed = parser.parse(unescapeXml(parsed.string._text));
    } else if (parsed.string.ResponseDoc) {
      parsed = parsed.string;
    }
  }

  const doc = parsed.ResponseDoc || parsed.InvoicesDoc || parsed;
  let resp = doc.response || doc.invoice;
  if (Array.isArray(resp)) resp = resp[0];

  if (!resp) {
    return { success: false, errors: ['Invalid response structure'] };
  }

  const statusCode = resp.statusCode ? String(resp.statusCode) : undefined;
  const isSuccess = statusCode === 'Success' || statusCode === '200';

  if (!isSuccess) {
    const errList = [];
    const errorsObj = resp.errors?.error || doc.errors?.error;
    if (errorsObj) {
      const arr = Array.isArray(errorsObj) ? errorsObj : [errorsObj];
      for (const e of arr) {
        const code = e.code !== undefined ? String(e.code) : '';
        const msg = e.message !== undefined ? String(e.message) : String(e);
        errList.push(code ? `${code}: ${msg}` : msg);
      }
    } else {
      errList.push(`Error with status: ${statusCode || 'Unknown'}`);
    }
    return {
      success: false,
      statusCode,
      errors: errList,
    };
  }

  const mark = resp.invoiceMark !== undefined && resp.invoiceMark !== null ? String(resp.invoiceMark) : undefined;
  const invoiceUid = resp.invoiceUid !== undefined && resp.invoiceUid !== null ? String(resp.invoiceUid) : undefined;
  const qrUrl = resp.qrUrl ? String(resp.qrUrl) : undefined;

  return {
    success: true,
    statusCode,
    mark,
    invoiceUid,
    qrUrl,
  };
}

const errXml = '<string xmlns="http://schemas.microsoft.com/2003/10/Serialization/"><?xml version="1.0" encoding="utf-8"?><ResponseDoc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><response><index>1</index><statusCode>ValidationError</statusCode><errors><error><message>Line number: 1. Sum of VAT classifications are not equal to line\'s value</message><code>306</code></error></errors></response></ResponseDoc></string>';
console.log('Error test result:', parseAADEResponse(errXml));

const successXml = '<string xmlns="http://schemas.microsoft.com/2003/10/Serialization/"><?xml version="1.0" encoding="utf-8"?><ResponseDoc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><response><index>1</index><invoiceUid>400001859348234</invoiceUid><invoiceMark>400001859348234</invoiceMark><qrUrl>https://mydataapidev.aade.gr/open?q=abc&amp;mark=400001859348234</qrUrl><statusCode>Success</statusCode></response></ResponseDoc></string>';
console.log('Success test result:', parseAADEResponse(successXml));

const encodedXml = '<string xmlns="http://schemas.microsoft.com/2003/10/Serialization/">&lt;?xml version="1.0" encoding="utf-8"?&gt;&lt;ResponseDoc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"&gt;&lt;response&gt;&lt;index&gt;1&lt;/index&gt;&lt;invoiceUid&gt;400001859348234&lt;/invoiceUid&gt;&lt;invoiceMark&gt;400001859348234&lt;/invoiceMark&gt;&lt;qrUrl&gt;https://mydataapidev.aade.gr/open?q=abc&amp;amp;mark=400001859348234&lt;/qrUrl&gt;&lt;statusCode&gt;Success&lt;/statusCode&gt;&lt;/response&gt;&lt;/ResponseDoc&gt;</string>';
console.log('Encoded test result:', parseAADEResponse(encodedXml));
