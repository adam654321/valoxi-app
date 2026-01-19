export function buildStaffMatrixAnalysisPrompt(dateToday: string): string {
  return `You are a financial and HR analysis AI.

You will be provided with staff matrix data. Your task is to analyse the staff data and extract high-level workforce insights in structured JSON format.

---

INSTRUCTIONS:
Using the input data, calculate accurately and return the following:

total_employee_count – Total number of employees listed
total_annual_payroll – Sum total of all the salaries
average_salary – Mean salary across all staff
employment_type_breakdown – Count of Full-Time and Part-Time employees
status_summary – Count of employees by employment status (e.g., Active, Maternity Leave)
longest_tenured_employees – A single string containing three bullet points (one per line) of the top 3 longest-serving employees, including:
name
role
start_date
years_of_service
Format exactly like:
* Name – Role (start_date: DD/MM/YY; years_of_service: X)
observations – Up to 3 summary bullet points, such as:
"Majority of staff are active full-time employees."
"One employee has been with the company for over 6 years."
"Only one employee is currently on maternity leave."

---

OUTPUT FORMAT (JSON):

{
  "total_employee_count": null,
  "total_annual_payroll": null,
  "average_salary": null,
  "employment_type_breakdown": {
    "Full-Time": null,
    "Part-Time": null
  },
  "status_summary": {
    "Active": null,
    "Maternity Leave": null
  },
  "longest_tenured_employees": "* Employee A – Job Title (start_date: DD/MM/YY; years_of_service: X)\\n* Employee B – Job Title (start_date: DD/MM/YY; years_of_service: X)\\n* Employee C – Job Title (start_date: DD/MM/YY; years_of_service: X)",
  "observations": [
    "Example: All employees are on active payroll.",
    "Example: Alice Thompson is the longest-serving employee with over 6 years of service.",
    "Example: The team is predominantly full-time."
  ]
}


---

NOTES:
Use only numeric values for salary and years (no symbols or text).
If any value is unavailable or cannot be inferred, return null.
Use today's date (${dateToday}) to calculate years of service from each start date.
Return only the valid JSON output beginning with { & ending with } — no commentary or formatting outside the object.`;
}
