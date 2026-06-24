import nodemailer from 'nodemailer';

// Send-to-Kindle: email the EPUB to the user's @kindle.com address from an approved
// sender. All config via .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, KINDLE_EMAIL.
export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.KINDLE_EMAIL);
}

export async function sendToKindle(epub: Buffer, filename: string): Promise<void> {
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
  await transport.sendMail({
    from: process.env.SMTP_USER!,
    to: process.env.KINDLE_EMAIL!,
    subject: filename.replace(/\.epub$/, ''),
    text: 'Your kitt daily paper.',
    attachments: [{ filename, content: epub }],
  });
}
