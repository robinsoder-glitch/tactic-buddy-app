import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  senderName?: string
  senderEmail?: string
  senderTeams?: string
  subjectLine?: string
  message?: string
}

const Email = ({ senderName, senderEmail, senderTeams, subjectLine, message }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{subjectLine ? `Kontakt: ${subjectLine}` : 'Nytt meddelande från Fotbollsrummet'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Ny fråga från Fotbollsrummet</Heading>

        <Section style={card}>
          <Text style={row}><strong>Namn:</strong> {senderName || 'Okänt namn'}</Text>
          <Text style={row}><strong>E-post:</strong> {senderEmail || 'Okänd e-post'}</Text>
          {senderTeams ? <Text style={row}><strong>Lag:</strong> {senderTeams}</Text> : null}
          <Text style={row}><strong>Ämne:</strong> {subjectLine || '–'}</Text>
        </Section>

        <Text style={label}>Meddelande</Text>
        <Section style={messageBox}>
          <Text style={messageText}>{message || ''}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={notice}>
          Svara direkt på användarens e-postadress ovan – detta mejl kommer från en adress som
          inte tar emot svar.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data['subjectLine'] ? `Kontakt: ${data['subjectLine']}` : 'Ny fråga från Fotbollsrummet',
  displayName: 'Kontaktmeddelande till oss',
  previewData: {
    senderName: 'Robin Söder',
    senderEmail: 'robin@example.com',
    senderTeams: 'IFK Exempel P14',
    subjectLine: 'Fråga om samlingstider',
    message: 'Hej! Var hittar jag samlingstiden för lördagens match?',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const heading = { fontSize: '22px', margin: '0 0 12px', color: '#0b3d2c' }
const card = {
  backgroundColor: '#f3f7f5',
  borderRadius: '12px',
  padding: '12px 16px',
  margin: '16px 0',
}
const row = { fontSize: '15px', lineHeight: '22px', margin: '6px 0', color: '#1f2933' }
const label = { fontSize: '13px', fontWeight: 'bold' as const, color: '#52635b', margin: '0 0 4px' }
const messageBox = {
  border: '1px solid #e3e8e6',
  borderRadius: '12px',
  padding: '12px 16px',
}
const messageText = { fontSize: '15px', lineHeight: '24px', color: '#1f2933', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e3e8e6', margin: '20px 0' }
const notice = { fontSize: '14px', lineHeight: '22px', color: '#0b3d2c', fontWeight: 'bold' as const }
