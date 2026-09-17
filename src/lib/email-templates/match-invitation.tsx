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
  playerName?: string
  teamName?: string
  matchTitle?: string
  startsAt?: string
  meetAt?: string
  location?: string
  respondBy?: string
  message?: string
}

const Email = ({
  playerName,
  teamName,
  matchTitle,
  startsAt,
  meetAt,
  location,
  respondBy,
  message,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{matchTitle ? `Kallelse: ${matchTitle}` : 'Ny kallelse till match'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Kallelse till match</Heading>
        <Text style={text}>
          Hej{playerName ? ` ${playerName}` : ''}! {teamName ? `${teamName} har ` : 'Laget har '}
          skickat en kallelse.
        </Text>

        <Section style={card}>
          {matchTitle ? <Text style={row}><strong>Match:</strong> {matchTitle}</Text> : null}
          {startsAt ? <Text style={row}><strong>Tid:</strong> {startsAt}</Text> : null}
          {meetAt ? <Text style={row}><strong>Samling:</strong> {meetAt}</Text> : null}
          {location ? <Text style={row}><strong>Plats:</strong> {location}</Text> : null}
          {respondBy ? <Text style={row}><strong>Svara senast:</strong> {respondBy}</Text> : null}
        </Section>

        {message ? <Text style={text}>{message}</Text> : null}

        <Hr style={hr} />
        <Text style={notice}>
          Du måste logga in i Fotbollsrummet och svara på kallelsen där. Svar via mejl registreras
          inte.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data['matchTitle'] ? `Kallelse: ${data['matchTitle']}` : 'Kallelse till match',
  displayName: 'Kallelse till match',
  previewData: {
    playerName: 'Robin',
    teamName: 'IFK Exempel P14',
    matchTitle: 'IFK Exempel – Exempel BK',
    startsAt: 'lördag 20 september kl. 11:00',
    meetAt: 'kl. 10:15',
    location: 'Exempelvallen, Exempelgatan 1',
    respondBy: 'torsdag 18 september',
    message: 'Ta med både svart och vit tröja.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const heading = { fontSize: '22px', margin: '0 0 12px', color: '#0b3d2c' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2933' }
const card = {
  backgroundColor: '#f3f7f5',
  borderRadius: '12px',
  padding: '12px 16px',
  margin: '16px 0',
}
const row = { fontSize: '15px', lineHeight: '22px', margin: '6px 0', color: '#1f2933' }
const hr = { borderColor: '#e3e8e6', margin: '20px 0' }
const notice = { fontSize: '14px', lineHeight: '22px', color: '#0b3d2c', fontWeight: 'bold' as const }
