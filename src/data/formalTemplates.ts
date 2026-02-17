export interface FormalTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  variables: string[];
  format: string;
  content: string; // Rich HTML content for the template
}

export const formalTemplates: FormalTemplate[] = [
  {
    id: 'formal-1',
    name: 'Professional Cover Letter',
    category: 'Employment',
    description: 'Clean, modern layout for job applications.',
    variables: ['{{date}}', '{{recipient_name}}', '{{position}}', '{{company_name}}'],
    format: 'Letter',
    content: `<div style="font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #1a1a1a;">
<p style="text-align: right; margin-bottom: 24px;"><strong>{{date}}</strong></p>

<p style="margin-bottom: 4px;">{{recipient_name}}</p>
<p style="margin-bottom: 4px;">Human Resources Department</p>
<p style="margin-bottom: 24px;">{{company_name}}</p>

<p style="margin-bottom: 16px;">Dear {{recipient_name}},</p>

<p style="margin-bottom: 16px;">I am writing to express my interest in the <strong>{{position}}</strong> position at <strong>{{company_name}}</strong>. With my background and professional experience, I am confident that I would be a valuable addition to your team.</p>

<p style="margin-bottom: 16px;">Throughout my career, I have developed strong skills in [area of expertise], which I believe align well with the requirements of this role. My ability to [key competency] has consistently driven positive results in my previous positions.</p>

<p style="margin-bottom: 16px;">I am particularly drawn to {{company_name}} because of [reason]. I am excited about the opportunity to contribute to your continued success and growth.</p>

<p style="margin-bottom: 16px;">I would welcome the opportunity to discuss how my qualifications align with your needs. Thank you for considering my application. I look forward to hearing from you.</p>

<p style="margin-bottom: 4px;">Sincerely,</p>
<p style="margin-bottom: 4px;"><br/><br/></p>
<p>[Your Full Name]</p>
<p>[Your Phone Number]</p>
<p>[Your Email Address]</p>
</div>`
  },
  {
    id: 'formal-2',
    name: 'Service Contract',
    category: 'Legal',
    description: 'Standard agreement for freelancers and agencies.',
    variables: ['{{client_name}}', '{{service_description}}', '{{total_amount}}', '{{start_date}}'],
    format: 'Legal',
    content: `<div style="font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.7; color: #1a1a1a;">
<h1 style="text-align: center; font-size: 20px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;">Service Agreement</h1>
<p style="text-align: center; margin-bottom: 32px; color: #666;">Contract No. ___________</p>

<p style="margin-bottom: 16px;">This Service Agreement ("Agreement") is entered into as of <strong>{{start_date}}</strong>, by and between:</p>

<p style="margin-bottom: 8px;"><strong>SERVICE PROVIDER:</strong> [Your Name / Company], hereinafter referred to as "Provider"</p>
<p style="margin-bottom: 16px;"><strong>CLIENT:</strong> <strong>{{client_name}}</strong>, hereinafter referred to as "Client"</p>

<h2 style="font-size: 15px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">1. SCOPE OF SERVICES</h2>
<p style="margin-bottom: 16px;">The Provider agrees to perform the following services: <strong>{{service_description}}</strong></p>

<h2 style="font-size: 15px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">2. COMPENSATION</h2>
<p style="margin-bottom: 16px;">The Client agrees to pay the Provider a total amount of <strong>{{total_amount}}</strong> for the services described in Section 1. Payment shall be made as follows: [specify payment schedule].</p>

<h2 style="font-size: 15px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">3. TERM</h2>
<p style="margin-bottom: 16px;">This Agreement shall commence on <strong>{{start_date}}</strong> and shall continue until the completion of the services or until terminated by either party with 30 days written notice.</p>

<h2 style="font-size: 15px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">4. CONFIDENTIALITY</h2>
<p style="margin-bottom: 16px;">Both parties agree to maintain the confidentiality of any proprietary information shared during the course of this agreement.</p>

<h2 style="font-size: 15px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">5. SIGNATURES</h2>
<div style="display: flex; justify-content: space-between; margin-top: 40px;">
<div style="width: 45%;">
<p style="border-top: 1px solid #333; padding-top: 8px;">Provider Signature</p>
<p>Date: _______________</p>
</div>
<div style="width: 45%;">
<p style="border-top: 1px solid #333; padding-top: 8px;">Client Signature ({{client_name}})</p>
<p>Date: _______________</p>
</div>
</div>
</div>`
  },
  {
    id: 'formal-3',
    name: 'Commercial Invoice',
    category: 'Finance',
    description: 'Tax-compliant invoice format with automatic totals.',
    variables: ['{{invoice_number}}', '{{due_date}}', '{{subtotal}}', '{{tax}}'],
    format: 'A4',
    content: `<div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1a;">
<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
<div>
<h1 style="font-size: 28px; font-weight: 700; color: #7C5C3F; margin-bottom: 4px;">INVOICE</h1>
<p style="color: #666; font-size: 12px;">Invoice #<strong>{{invoice_number}}</strong></p>
</div>
<div style="text-align: right;">
<p style="font-weight: 600;">[Your Company Name]</p>
<p style="color: #666; font-size: 12px;">[Your Address Line 1]</p>
<p style="color: #666; font-size: 12px;">[City, State, Zip]</p>
<p style="color: #666; font-size: 12px;">[Phone] | [Email]</p>
</div>
</div>

<div style="display: flex; justify-content: space-between; margin-bottom: 32px; background: #f8f6f3; padding: 16px; border-radius: 8px;">
<div>
<p style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Bill To</p>
<p style="font-weight: 600; margin-top: 4px;">[Client Name]</p>
<p style="color: #666; font-size: 12px;">[Client Address]</p>
</div>
<div style="text-align: right;">
<p style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Due Date</p>
<p style="font-weight: 600; margin-top: 4px; color: #7C5C3F;">{{due_date}}</p>
</div>
</div>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
<thead>
<tr style="border-bottom: 2px solid #7C5C3F;">
<th style="text-align: left; padding: 8px 4px; font-size: 11px; text-transform: uppercase; color: #666;">Description</th>
<th style="text-align: center; padding: 8px 4px; font-size: 11px; text-transform: uppercase; color: #666;">Qty</th>
<th style="text-align: right; padding: 8px 4px; font-size: 11px; text-transform: uppercase; color: #666;">Unit Price</th>
<th style="text-align: right; padding: 8px 4px; font-size: 11px; text-transform: uppercase; color: #666;">Amount</th>
</tr>
</thead>
<tbody>
<tr style="border-bottom: 1px solid #eee;">
<td style="padding: 12px 4px;">[Item description]</td>
<td style="text-align: center; padding: 12px 4px;">1</td>
<td style="text-align: right; padding: 12px 4px;">$0.00</td>
<td style="text-align: right; padding: 12px 4px;">$0.00</td>
</tr>
<tr style="border-bottom: 1px solid #eee;">
<td style="padding: 12px 4px;">[Item description]</td>
<td style="text-align: center; padding: 12px 4px;">1</td>
<td style="text-align: right; padding: 12px 4px;">$0.00</td>
<td style="text-align: right; padding: 12px 4px;">$0.00</td>
</tr>
</tbody>
</table>

<div style="display: flex; justify-content: flex-end;">
<div style="width: 250px;">
<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
<span style="color: #666;">Subtotal</span>
<span style="font-weight: 600;">{{subtotal}}</span>
</div>
<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
<span style="color: #666;">Tax</span>
<span style="font-weight: 600;">{{tax}}</span>
</div>
<div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 16px; font-weight: 700; color: #7C5C3F;">
<span>Total</span>
<span>[Total Amount]</span>
</div>
</div>
</div>

<div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd;">
<p style="font-size: 11px; color: #888;">Payment Terms: Net 30 days. Please make payments to the account specified above.</p>
<p style="font-size: 11px; color: #888; margin-top: 4px;">Thank you for your business!</p>
</div>
</div>`
  },
  {
    id: 'formal-4',
    name: 'Formal Petition (PQR)',
    category: 'Legal',
    description: 'Standard request format for government or corporate claims.',
    variables: ['{{petition_type}}', '{{case_number}}', '{{requested_resolution}}'],
    format: 'Letter',
    content: `<div style="font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.8; color: #1a1a1a;">
<p style="text-align: right; margin-bottom: 32px;">[City], [Date]</p>

<p style="margin-bottom: 4px;"><strong>To:</strong> [Authority / Department Name]</p>
<p style="margin-bottom: 4px;">[Organization / Entity]</p>
<p style="margin-bottom: 24px;">[Address]</p>

<p style="margin-bottom: 8px;"><strong>Subject:</strong> {{petition_type}}</p>
<p style="margin-bottom: 24px;"><strong>Reference No.:</strong> {{case_number}}</p>

<p style="margin-bottom: 16px;">Dear Sir/Madam,</p>

<p style="margin-bottom: 16px;">I, [Full Name], identified with [ID Type] number [ID Number], hereby submit this formal petition regarding the matter referenced above.</p>

<p style="margin-bottom: 16px;"><strong>FACTS:</strong></p>
<p style="margin-bottom: 16px;">1. [Describe the factual circumstances that give rise to this petition]</p>
<p style="margin-bottom: 16px;">2. [Additional relevant facts]</p>

<p style="margin-bottom: 16px;"><strong>REQUEST:</strong></p>
<p style="margin-bottom: 16px;">Based on the above facts and in accordance with applicable regulations, I respectfully request: <strong>{{requested_resolution}}</strong></p>

<p style="margin-bottom: 16px;"><strong>LEGAL BASIS:</strong></p>
<p style="margin-bottom: 16px;">[Cite relevant laws, regulations, or contractual provisions]</p>

<p style="margin-bottom: 16px;">I kindly request that this petition be addressed within the legally established timeframe. I can be reached at [phone] or [email] for any additional information required.</p>

<p style="margin-bottom: 4px;">Respectfully,</p>
<p style="margin-bottom: 4px;"><br/><br/></p>
<p style="margin-bottom: 4px;">______________________________</p>
<p style="margin-bottom: 4px;">[Full Name]</p>
<p style="margin-bottom: 4px;">[ID Number]</p>
<p>[Contact Information]</p>
</div>`
  },
  {
    id: 'formal-5',
    name: 'Non-Disclosure Agreement',
    category: 'Legal',
    description: 'Protect confidential information before sharing.',
    variables: ['{{disclosing_party}}', '{{effective_date}}', '{{jurisdiction}}'],
    format: 'Legal',
    content: `<div style="font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.7; color: #1a1a1a;">
<h1 style="text-align: center; font-size: 20px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 2px;">Non-Disclosure Agreement</h1>
<p style="text-align: center; color: #666; margin-bottom: 32px;">(Mutual)</p>

<p style="margin-bottom: 16px;">This Non-Disclosure Agreement ("Agreement") is entered into as of <strong>{{effective_date}}</strong>, by and between:</p>

<p style="margin-bottom: 8px;"><strong>Party A (Disclosing Party):</strong> {{disclosing_party}}</p>
<p style="margin-bottom: 16px;"><strong>Party B (Receiving Party):</strong> [Full Name / Company]</p>

<h2 style="font-size: 14px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">1. DEFINITION OF CONFIDENTIAL INFORMATION</h2>
<p style="margin-bottom: 16px;">"Confidential Information" means all non-public information disclosed by either party, including but not limited to: business plans, financial data, technical specifications, customer lists, trade secrets, and any other proprietary information.</p>

<h2 style="font-size: 14px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">2. OBLIGATIONS</h2>
<p style="margin-bottom: 16px;">The Receiving Party agrees to: (a) hold the Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it solely for the purpose of evaluating or engaging in business with the Disclosing Party.</p>

<h2 style="font-size: 14px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">3. TERM</h2>
<p style="margin-bottom: 16px;">This Agreement shall remain in effect for a period of two (2) years from the Effective Date, unless terminated earlier by mutual written agreement.</p>

<h2 style="font-size: 14px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">4. GOVERNING LAW</h2>
<p style="margin-bottom: 16px;">This Agreement shall be governed by and construed in accordance with the laws of <strong>{{jurisdiction}}</strong>.</p>

<h2 style="font-size: 14px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">5. SIGNATURES</h2>
<div style="display: flex; justify-content: space-between; margin-top: 40px;">
<div style="width: 45%;">
<p style="border-top: 1px solid #333; padding-top: 8px;">Party A: {{disclosing_party}}</p>
<p>Date: _______________</p>
</div>
<div style="width: 45%;">
<p style="border-top: 1px solid #333; padding-top: 8px;">Party B: [Receiving Party]</p>
<p>Date: _______________</p>
</div>
</div>
</div>`
  },
  {
    id: 'formal-6',
    name: 'Meeting Minutes',
    category: 'Business',
    description: 'Professional meeting minutes with action items.',
    variables: ['{{meeting_date}}', '{{meeting_title}}', '{{attendees}}', '{{location}}'],
    format: 'A4',
    content: `<div style="font-family: 'Helvetica', Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #1a1a1a;">
<div style="background: #7C5C3F; color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
<h1 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">{{meeting_title}}</h1>
<p style="opacity: 0.9; font-size: 12px;">Meeting Minutes</p>
</div>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8f6f3; padding: 16px; border-radius: 8px;">
<div>
<p style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Date</p>
<p style="font-weight: 600;">{{meeting_date}}</p>
</div>
<div>
<p style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Location</p>
<p style="font-weight: 600;">{{location}}</p>
</div>
<div style="grid-column: 1 / -1;">
<p style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: 600;">Attendees</p>
<p>{{attendees}}</p>
</div>
</div>

<h2 style="font-size: 15px; border-bottom: 2px solid #7C5C3F; padding-bottom: 4px; margin-bottom: 12px;">Agenda Items</h2>

<h3 style="font-size: 14px; margin-top: 16px; margin-bottom: 8px;">1. [Topic]</h3>
<p style="margin-bottom: 8px;">[Discussion notes]</p>
<p style="margin-bottom: 16px; padding: 8px 12px; background: #fff8f0; border-left: 3px solid #B8925C; font-size: 12px;"><strong>Action Item:</strong> [Description] — <em>Assigned to: [Name] | Due: [Date]</em></p>

<h3 style="font-size: 14px; margin-top: 16px; margin-bottom: 8px;">2. [Topic]</h3>
<p style="margin-bottom: 8px;">[Discussion notes]</p>
<p style="margin-bottom: 16px; padding: 8px 12px; background: #fff8f0; border-left: 3px solid #B8925C; font-size: 12px;"><strong>Action Item:</strong> [Description] — <em>Assigned to: [Name] | Due: [Date]</em></p>

<h2 style="font-size: 15px; border-bottom: 2px solid #7C5C3F; padding-bottom: 4px; margin-bottom: 12px; margin-top: 32px;">Next Meeting</h2>
<p>Date: _____________ | Time: _____________ | Location: _____________</p>

<div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd;">
<p style="font-size: 12px; color: #666;">Minutes recorded by: _______________</p>
<p style="font-size: 12px; color: #666;">Approved by: _______________</p>
</div>
</div>`
  }
];
