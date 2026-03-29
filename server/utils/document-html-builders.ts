export function buildSignatureBlock(documentType: string, docData: any, responses: any[], respondedAt: Date | null): string {
  const sellerResponse = responses.length > 0 ? responses[0] : null;
  const isSigned = !!sellerResponse || !!respondedAt;
  const signedDate = sellerResponse
    ? new Date(sellerResponse.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : respondedAt
      ? new Date(respondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

  const buyerName = docData?.buyerSignatoryName || '';
  const buyerTitle = docData?.buyerSignatoryTitle || '';
  const buyerCompany = docData?.buyerCompanyName || '';
  const sellerName = sellerResponse?.respondentName || '';
  const sellerCompany = docData?.sellerCompanyName || '';

  const docTitleMap: Record<string, string> = {
    'nda': 'Non-Disclosure Agreement',
    'offer_letter': 'Offer Letter',
    'heads_of_terms': 'Heads of Terms',
  };
  const docTitle = docTitleMap[documentType] || 'Agreement';

  const buyerLabelMap: Record<string, string> = {
    'nda': 'Disclosing Party (Buyer)',
    'offer_letter': 'Buyer',
    'heads_of_terms': 'Buyer',
  };
  const sellerLabelMap: Record<string, string> = {
    'nda': 'Receiving Party (Seller)',
    'offer_letter': 'Seller',
    'heads_of_terms': 'Seller',
  };

  return `
    <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #333;">
      <h2 style="text-align: center; font-size: 16px; font-weight: 700; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px;">Execution</h2>
      <p style="margin-bottom: 24px; font-size: 13px;">IN WITNESS WHEREOF, the parties hereto have executed this ${docTitle} as of the date last signed below.</p>
      <div style="display: flex; justify-content: space-between; gap: 40px;">
        <div style="flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 12px; font-weight: 600;">${buyerLabelMap[documentType] || 'Buyer'}</p>
          <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;">
            <span style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; color: #1a3a5c;">${buyerName}</span>
          </div>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> ${buyerName}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Title:</strong> ${buyerTitle}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Company:</strong> ${buyerCompany}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Date:</strong> ${docData?.currentDate || ''}</p>
        </div>
        <div style="flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 12px; font-weight: 600;">${sellerLabelMap[documentType] || 'Seller'}</p>
          ${sellerName ? `
            <div style="border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;">
              <span style="font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 22px; color: #1a3a5c;">${sellerName}</span>
            </div>
            <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> ${sellerName}</p>
          ` : `
            <div style="border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; min-height: 28px;"></div>
            <p style="font-size: 13px; margin: 4px 0;"><strong>Name:</strong> _______________</p>
          `}
          <p style="font-size: 13px; margin: 4px 0;"><strong>Company:</strong> ${sellerCompany}</p>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Date:</strong> ${isSigned ? signedDate : '_______________'}</p>
        </div>
      </div>
      ${isSigned ? `
        <div style="margin-top: 20px; padding: 12px 16px; background: #f0f7f0; border: 1px solid #c3e6c3; border-radius: 6px; text-align: center;">
          <p style="font-size: 12px; color: #2d6a2d; margin: 0;">
            ✓ This document was electronically signed and executed on <strong>${signedDate}</strong>
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

export function buildNdaHtml(data: any): string {
  const buyerCompanyName = data.buyerCompanyName || '';
  const buyerSignatoryName = data.buyerSignatoryName || '';
  const buyerSignatoryTitle = data.buyerSignatoryTitle || 'Director';
  const sellerCompanyName = data.sellerCompanyName || '';
  const sellerAddress = data.sellerAddress || '';
  const currentDate = data.currentDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const productOrService = data.productOrService || `the business operations of ${sellerCompanyName}`;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; max-width: 700px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 20px; text-align: center; margin-bottom: 8px;">NON-DISCLOSURE AGREEMENT</h1>
      <p style="text-align: center; color: #555; font-size: 13px; margin-bottom: 32px;">Confidential — Not for Distribution</p>

      <p>${currentDate}</p>
      <p><strong>${sellerCompanyName}</strong><br/>${sellerAddress.replace(/\n/g, '<br/>')}</p>
      <br/>

      <p>Dear Sir/Madam,</p>

      <p>This Non-Disclosure Agreement (<strong>"Agreement"</strong>) is entered into between:</p>

      <p><strong>Disclosing Party:</strong> ${sellerCompanyName}, the owner of the business known as ${productOrService}.</p>
      <p><strong>Receiving Party:</strong> ${buyerCompanyName} (<strong>"the Buyer"</strong>).</p>

      <br/>
      <h2 style="font-size: 15px;">1. PURPOSE</h2>
      <p>The Receiving Party wishes to evaluate a potential acquisition of ${productOrService} (the <strong>"Proposed Transaction"</strong>). In connection with this evaluation, the Disclosing Party may disclose certain confidential and proprietary information to the Receiving Party.</p>

      <h2 style="font-size: 15px;">2. CONFIDENTIAL INFORMATION</h2>
      <p>For the purposes of this Agreement, <strong>"Confidential Information"</strong> means all information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or by any other means, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. This includes, without limitation, financial data, customer lists, business plans, trade secrets, operational procedures, and any other information relating to the business of the Disclosing Party.</p>

      <h2 style="font-size: 15px;">3. OBLIGATIONS</h2>
      <p>The Receiving Party agrees to:</p>
      <p>(a) hold all Confidential Information in strict confidence;</p>
      <p>(b) not disclose Confidential Information to any third party without the prior written consent of the Disclosing Party;</p>
      <p>(c) use the Confidential Information solely for the purpose of evaluating the Proposed Transaction;</p>
      <p>(d) limit access to Confidential Information to those of its advisors, employees, or agents who have a need to know and who are bound by obligations of confidentiality no less restrictive than those set out herein.</p>

      <h2 style="font-size: 15px;">4. EXCLUSIONS</h2>
      <p>The obligations in clause 3 shall not apply to information that:</p>
      <p>(a) is or becomes publicly available through no fault of the Receiving Party;</p>
      <p>(b) was rightfully known to the Receiving Party prior to disclosure;</p>
      <p>(c) is independently developed by the Receiving Party without use of Confidential Information; or</p>
      <p>(d) is required to be disclosed by law or court order, provided the Receiving Party gives prompt written notice to the Disclosing Party.</p>

      <h2 style="font-size: 15px;">5. TERM</h2>
      <p>This Agreement shall remain in effect for a period of two (2) years from the date of signing, unless terminated earlier by mutual written consent of the parties.</p>

      <h2 style="font-size: 15px;">6. RETURN OF INFORMATION</h2>
      <p>Upon request by the Disclosing Party or upon termination of discussions relating to the Proposed Transaction, the Receiving Party shall promptly return or destroy all Confidential Information and any copies thereof.</p>

      <h2 style="font-size: 15px;">7. NO LICENCE</h2>
      <p>Nothing in this Agreement grants the Receiving Party any right, title, or interest in or to the Confidential Information or any intellectual property of the Disclosing Party.</p>

      <h2 style="font-size: 15px;">8. GOVERNING LAW</h2>
      <p>This Agreement shall be governed by and construed in accordance with the laws of England and Wales. The parties submit to the exclusive jurisdiction of the courts of England and Wales.</p>

      <br/>
      <p>Agreed and accepted on behalf of the Receiving Party:</p>
      <br/>
      <p><strong>${buyerSignatoryName}</strong><br/>${buyerSignatoryTitle}<br/>${buyerCompanyName}</p>
    </div>
  `;
}

export function buildOfferLetterHtml(data: any): string {
  const raw = data._raw || {};

  const fmt = (val: any) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(num);
  };

  const breakdownLines: string[] = [];
  if (data.breakdownText) {
    data.breakdownText.split('\n').filter((l: string) => l.trim()).forEach((l: string) => breakdownLines.push(l));
  } else {
    breakdownLines.push(`Enterprise Value (Adjusted EBITDA × ${raw.ebitdaMultiple || 0} multiple): ${fmt(raw.enterpriseValue)}`);
    if (raw.excessCash > 0) breakdownLines.push(`Plus Excess Cash: ${fmt(raw.excessCash)}`);
    if (raw.propertyValue > 0) breakdownLines.push(`Plus Property Value: ${fmt(raw.propertyValue)}`);
    if (raw.primaryDebt > 0) breakdownLines.push(`Less Primary Debt: (${fmt(raw.primaryDebt)})`);
    if (raw.otherDebt > 0) breakdownLines.push(`Less Other Debt: (${fmt(raw.otherDebt)})`);
    if (raw.corpTaxDue > 0) breakdownLines.push(`Less Corporation Tax Due: (${fmt(raw.corpTaxDue)})`);
    if (raw.workingCapitalAdj > 0) breakdownLines.push(`Less Working Capital Adjustment: (${fmt(raw.workingCapitalAdj)})`);
  }

  let paymentHtml = '';
  if (raw.dayOnePayment > 0) {
    paymentHtml += `<p>Payment due to the seller at closing: <strong>${fmt(raw.dayOnePayment)}</strong></p>`;
  }
  if (raw.deferredAmount > 0) {
    paymentHtml += `<p>Deferred consideration: <strong>${fmt(raw.deferredAmount)}</strong></p>`;
    if (raw.deferredTermMonths > 0) {
      paymentHtml += `<p>Deferred terms: Payable over ${raw.deferredTermMonths} months post-completion</p>`;
    } else if (raw.deferredTerms) {
      paymentHtml += `<p>Deferred terms: ${raw.deferredTerms}</p>`;
    }
  }
  if (raw.earnoutMaximum > 0) {
    paymentHtml += `<p>Earnout (maximum): <strong>${fmt(raw.earnoutMaximum)}</strong></p>`;
    if (raw.earnoutMetric) {
      paymentHtml += `<p>Earnout details: ${raw.earnoutMetric}</p>`;
    }
    if (raw.earnoutTermMonths > 0) {
      paymentHtml += `<p>Earnout period: ${raw.earnoutTermMonths} months</p>`;
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p><strong>${data.sellerCompanyName || ''}</strong></p>
      <p>${data.sellerAddress || ''}</p>
      <p>${data.currentDate || ''}</p>
      <br/>
      <p><strong>Re: Indicative Offer — ${data.sellerCompanyName || ''} (${data.transactionTypeLabel || 'Share Sale'})</strong></p>
      <br/>
      <p>Further to our conversations, I have the pleasure of enclosing an indicative offer for ${data.transactionDescription || '100% of the share capital'} of ${data.sellerCompanyName || ''}.</p>
      <br/>
      <h3 style="margin-bottom: 8px;">The total offer price is ${data.offerPrice || fmt(raw.offerPrice)}</h3>
      <br/>
      <p><strong>This is comprised as follows:</strong></p>
      <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 12px 0;">
        ${breakdownLines.map(line => `<tr><td style="padding: 4px 0;">${line}</td></tr>`).join('\n')}
        ${!data.breakdownText ? `<tr><td style="padding: 8px 0; border-top: 2px solid #333;"><strong>Total Offer Price: ${data.offerPrice || fmt(raw.offerPrice)}</strong></td></tr>` : ''}
      </table>
      <br/>
      ${paymentHtml ? `<p><strong>Payment Structure:</strong></p>${paymentHtml}<br/>` : ''}
      <p>This offer is subject to due diligence and legal contract. I trust this offer meets with your approval and await your response. Following the acceptance of this offer, a heads of terms document will be submitted and negotiated to include agreements on working capital, exclusivity period and a timetable for due diligence and legal contract.</p>
      <br/>
      <p>Yours sincerely,</p>
    </div>
  `;
}

export function buildHoTHtml(data: any): string {
  const raw = data._raw || {};

  const fmt = (val: any) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(num);
  };

  const breakdownLines: string[] = [];
  if (data.breakdownText) {
    data.breakdownText.split('\n').filter((l: string) => l.trim()).forEach((l: string) => {
      breakdownLines.push(l.replace(/^Total Offer Price:/i, 'Total Consideration:'));
    });
  } else {
    breakdownLines.push(`Enterprise Value (Adjusted EBITDA × ${raw.ebitdaMultiple || 0} multiple): ${fmt(raw.enterpriseValue)}`);
    if (raw.excessCash > 0)        breakdownLines.push(`Plus Excess Cash: ${fmt(raw.excessCash)}`);
    if (raw.propertyValue > 0)     breakdownLines.push(`Plus Property Value: ${fmt(raw.propertyValue)}`);
    if (raw.primaryDebt > 0)       breakdownLines.push(`Less Primary Debt: (${fmt(raw.primaryDebt)})`);
    if (raw.otherDebt > 0)         breakdownLines.push(`Less Other Debt: (${fmt(raw.otherDebt)})`);
    if (raw.corpTaxDue > 0)        breakdownLines.push(`Less Corporation Tax Due: (${fmt(raw.corpTaxDue)})`);
    if (raw.workingCapitalAdj > 0) breakdownLines.push(`Less Working Capital Adjustment: (${fmt(raw.workingCapitalAdj)})`);
  }

  let paymentHtml = '';
  if (raw.dayOnePayment > 0) {
    paymentHtml += `<p>Payment due to the seller at closing: <strong>${fmt(raw.dayOnePayment)}</strong></p>`;
  }
  if (raw.deferredAmount > 0) {
    paymentHtml += `<p>Deferred consideration: <strong>${fmt(raw.deferredAmount)}</strong></p>`;
    if (data.deferredInstalment) {
      paymentHtml += `<p style="color:#555;font-size:0.95em;">Payable at: <strong>${data.deferredInstalment}</strong></p>`;
    } else if (raw.deferredTermMonths > 0) {
      paymentHtml += `<p style="color:#555;font-size:0.95em;">Terms: Payable over ${raw.deferredTermMonths} months post-completion</p>`;
    } else if (raw.deferredTerms) {
      paymentHtml += `<p style="color:#555;font-size:0.95em;">Terms: ${raw.deferredTerms}</p>`;
    }
  }
  if (raw.earnoutMaximum > 0) {
    paymentHtml += `<p>Earnout (maximum): <strong>${fmt(raw.earnoutMaximum)}</strong></p>`;
    if (raw.earnoutMetric)         paymentHtml += `<p style="color:#555;font-size:0.95em;">Metric: ${raw.earnoutMetric}</p>`;
    if (raw.earnoutTermMonths > 0) paymentHtml += `<p style="color:#555;font-size:0.95em;">Period: ${raw.earnoutTermMonths} months</p>`;
  }

  const transactionTypeLabel = data.transactionTypeLabel || 'Share Sale';
  const transactionDescription = data.transactionDescription || '100% of the share capital';
  const isAssetSale = (data.transactionType || 'share_sale') === 'asset_sale';
  const spaLabel = isAssetSale ? 'Asset Purchase Agreement' : 'Sale and Purchase Agreement';
  const spaAbbrev = isAssetSale ? 'APA' : 'SPA';

  const section = (num: number, title: string, binding: boolean) =>
    `<h2 style="margin-top:30px;padding-bottom:8px;border-bottom:1px solid #ddd;font-size:16px;">
      ${num}. ${title}
      <span style="font-size:11px;font-weight:normal;color:${binding ? '#b45309' : '#555'};margin-left:8px;">(${binding ? 'Binding' : 'Non-Binding'})</span>
    </h2>`;

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.7;max-width:700px;margin:0 auto;">

      <p style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#555;">PRIVATE AND CONFIDENTIAL — SUBJECT TO CONTRACT</p>

      <p style="margin:16px 0 4px;"><strong>${data.sellerCompanyName || ''}</strong></p>
      <p style="margin:0 0 4px;">${data.sellerAddress || ''}</p>
      <p style="margin:0 0 20px;">${data.currentDate || ''}</p>

      <h1 style="font-size:18px;margin:24px 0 8px;">HEADS OF TERMS — PROPOSED ACQUISITION OF ${(data.sellerCompanyName || '').toUpperCase()} (${transactionTypeLabel.toUpperCase()})</h1>

      <p>Dear ${data.sellerContactName || 'Sir/Madam'},</p>
      <p>Further to our recent discussions, this letter sets out the principal terms upon which <strong>${data.buyerCompanyName || ''}</strong> (the Buyer) is willing to acquire ${transactionDescription} of <strong>${data.sellerCompanyName || ''}</strong> (the Company). Save where expressly stated to be binding, this letter is non-binding and subject to contract.</p>

      ${section(1, 'PARTIES AND TRANSACTION OVERVIEW', false)}
      <p><strong>Buyer:</strong> ${data.buyerCompanyName || ''}</p>
      <p><strong>Seller:</strong> ${data.sellerContactName || ''}, ${data.sellerCompanyName || ''}</p>
      <p><strong>Transaction:</strong> Proposed ${transactionTypeLabel} of ${data.sellerCompanyName || ''}</p>
      ${isAssetSale ? `<p style="color:#555;font-size:0.95em;">Note: The Seller entity is not being acquired. The Buyer is acquiring specified assets and the goodwill of the business only. Liabilities remain with the Seller unless expressly assumed.</p>` : ''}

      ${section(2, 'PRICE AND CONSIDERATION', false)}
      <p>The total consideration for the acquisition is <strong>${data.offerPrice || fmt(raw.offerPrice)}</strong> (the Price), structured as follows:</p>
      ${paymentHtml || '<p>Full payment on completion.</p>'}

      ${section(3, 'PRICE ASSUMPTIONS', false)}
      <p>The Price is calculated on the following basis:</p>
      <table style="border-collapse:collapse;width:100%;max-width:550px;margin:12px 0;">
        ${breakdownLines.map(line => `<tr><td style="padding:5px 0;">${line}</td></tr>`).join('\n')}
        ${!data.breakdownText ? `<tr><td style="padding:10px 0 5px;border-top:2px solid #333;"><strong>Total Consideration: ${data.offerPrice || fmt(raw.offerPrice)}</strong></td></tr>` : ''}
      </table>
      ${isAssetSale
        ? `<p>The Price reflects the agreed value of the business and its goodwill as a going concern. The specific assets to be acquired will be set out in an Asset Schedule to be agreed during due diligence.</p>`
        : `<p>The Price is on a cash-free, debt-free basis, subject to a normalised level of working capital. Final Price will be adjusted through a completion accounts mechanism to reflect the actual cash, debt, and working capital position at the Completion Date.</p>`
      }

      ${section(4, 'CONDITIONS PRECEDENT', false)}
      <p>The Proposed Acquisition is conditional upon:</p>
      <p>(a) Satisfactory completion of legal and financial due diligence by the Buyer;</p>
      <p>(b) Agreement and execution of a formal ${spaLabel};</p>
      <p>(c) Confirmation of funding arrangements satisfactory to the Buyer;</p>
      ${isAssetSale ? `<p>(d) Agreement of the Asset Schedule identifying all assets to be transferred;</p>` : ''}
      <p>${isAssetSale ? '(e)' : '(d)'} No material adverse change in the business, assets, or financial position of the Company prior to Completion.</p>
      ${data.additionalConditions ? `<p><strong>Additional conditions:</strong> ${data.additionalConditions}</p>` : ''}

      ${section(5, 'DUE DILIGENCE', false)}
      <p>The Buyer will conduct legal, financial, tax, and commercial due diligence on the Company. The Seller agrees to provide all reasonable access to information, personnel, and records as requested. Due diligence will be conducted on a confidential basis and subject to the NDA previously agreed between the parties.</p>

      ${section(6, 'TIMETABLE', false)}
      <p>The parties will use reasonable endeavours to achieve completion of the Proposed Acquisition within <strong>${data.targetCompletionWeeks || raw.targetCompletionWeeks || 12} weeks</strong> of the date of this letter, subject to satisfactory completion of due diligence and agreement of the ${spaLabel}.</p>

      ${section(7, 'EXCLUSIVITY', true)}
      <p>In consideration of the Buyer incurring costs in connection with the Proposed Acquisition, the Seller undertakes that for a period of <strong>${data.exclusivityPeriodDays || raw.exclusivityPeriodDays || 90} days</strong> from the date of this letter the Seller shall not:</p>
      <p>(a) solicit, encourage, or entertain any approach from any third party relating to the sale or disposal of the Company or its business or assets;</p>
      <p>(b) enter into any negotiations or discussions with any third party in relation to such a transaction; or</p>
      <p>(c) provide any information to any third party in connection with any such transaction.</p>
      <p><strong>This clause 7 is binding on the parties.</strong></p>

      ${section(8, 'NON-COMPETE AND NON-SOLICITATION', false)}
      <p>It is intended that the ${spaLabel} will include undertakings by the Seller that for a period of <strong>${data.nonCompetePeriodYears || raw.nonCompetePeriodYears || 2} years</strong> following Completion, the Seller will not:</p>
      <p>(a) carry on or be engaged or interested in any business which competes with the business of the Company as at Completion;</p>
      <p>(b) solicit or entice away any employee, customer, or supplier of the Company for a period of <strong>${data.nonSolicitPeriodYears || raw.nonSolicitPeriodYears || 2} years</strong> following Completion.</p>

      ${section(9, 'WARRANTIES AND INDEMNITIES', false)}
      <p>The ${spaLabel} will include customary warranties from the Seller regarding the Company. It is intended that:</p>
      <p>(a) Warranty claims must be notified within <strong>${data.warrantyClaimPeriodMonths || raw.warrantyClaimPeriodMonths || 18} months</strong> of Completion;</p>
      <p>(b) The minimum individual claim threshold is <strong>${data.warrantyMinClaim || fmt(raw.warrantyMinClaim || 5000)}</strong>;</p>
      <p>(c) The aggregate warranty cap will be agreed during the ${spaAbbrev} negotiation.</p>

      ${section(10, isAssetSale ? 'ASSET PURCHASE AGREEMENT' : 'SALE AND PURCHASE AGREEMENT', false)}
      <p>The Proposed Acquisition will be documented by a formal ${spaLabel} to be prepared by the Buyer's solicitors. The ${spaAbbrev} will be in a form customary for a transaction of this nature and will reflect the terms set out in this letter together with such other terms as are agreed between the parties during due diligence and negotiation.</p>

      ${section(11, 'EMPLOYEES', false)}
      ${isAssetSale
        ? `<p>The Transfer of Undertakings (Protection of Employment) Regulations 2006 (TUPE) will automatically apply to this transaction. All employees of the business being acquired will transfer to the Buyer on their existing terms and conditions. The parties will cooperate to fulfil their respective information and consultation obligations under TUPE prior to Completion.</p>`
        : `<p>The Buyer intends to retain all existing employees of the Company following Completion. The transaction will be subject to applicable employment legislation including TUPE where relevant. Key management arrangements will be discussed and agreed during the due diligence period.</p>`
      }

      ${section(12, 'COSTS', true)}
      <p>Each party shall bear their own legal and professional costs incurred in connection with the Proposed Acquisition, whether or not the transaction proceeds to Completion. <strong>This clause 12 is binding on the parties.</strong></p>

      ${section(13, 'ANNOUNCEMENTS', true)}
      <p>Neither party shall make any public announcement or disclosure in connection with the Proposed Acquisition without the prior written consent of the other party, save as required by law or regulation. <strong>This clause 13 is binding on the parties.</strong></p>

      ${section(14, 'GOVERNING LAW', true)}
      <p>This letter and any non-contractual obligations arising from or in connection with it shall be governed by and construed in accordance with the laws of England and Wales. The parties submit to the exclusive jurisdiction of the courts of England and Wales. <strong>This clause 14 is binding on the parties.</strong></p>

      <p style="margin-top:32px;">Please confirm your agreement to the above terms by signing and returning a copy of this letter.</p>
      <p>Yours sincerely,</p>
      <p style="margin-top:24px;"><strong>${data.buyerSignatoryName || ''}</strong><br/>${data.buyerSignatoryTitle || ''}<br/>${data.buyerCompanyName || ''}</p>

    </div>
  `;
}
