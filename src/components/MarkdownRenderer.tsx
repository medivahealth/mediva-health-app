import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES } from '../theme';

interface ArticleCard {
  id: string;
  title: string;
  summary?: string;
  category?: string;
  url?: string;
}

interface Props {
  content: string;
  onFollowUp?: (question: string) => void;
  variant?: 'default' | 'chat';
  articles?: ArticleCard[];
  onArticlePress?: (article: ArticleCard) => void;
}

const TRUSTED_MEDICAL_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'nice.org.uk',
  'nhs.uk',
  'icmr.gov.in',
  'aiims.edu',
  'mohfw.gov.in',
  'cdsco.gov.in',
  'fda.gov',
  'thelancet.com',
  'nejm.org',
  'bmj.com',
  'jamanetwork.com',
];

function scoreMedicalSource(url: string, title: string): number {
  if (!url) return 0;
  let score = 0;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = parsed.hostname.toLowerCase();
    if (TRUSTED_MEDICAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) score += 70;
    if (parsed.protocol === 'https:') score += 10;
  } catch {
    return 0;
  }
  const t = (title || '').toLowerCase();
  if (/(guideline|consensus|meta-analysis|systematic review|clinical trial|recommendation)/i.test(t)) score += 10;
  if (/(journal|study|pubmed|cdc|who|icmr|fda|cdsco|nhs|nice)/i.test(t)) score += 10;
  return Math.min(100, score);
}

function safeOpenUrl(url: string) {
  if (!url || typeof url !== 'string') return;
  let finalUrl = url.trim();
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }
  try {
    new URL(finalUrl);
  } catch {
    return;
  }
  WebBrowser.openBrowserAsync(finalUrl).catch(() => {
    Linking.openURL(finalUrl).catch(() => {});
  });
}

function stripSeverityTag(text: string): string {
  return text.replace(/<!--\s*SEVERITY:\s*\w+\s*-->\s*/gi, '').trim();
}

function extractSourceMap(text: string): Record<string, { title: string; url: string }> {
  const map: Record<string, { title: string; url: string }> = {};
  const pattern1 = /\[(\d+)\]\s*\[([^\]]+)\]\(([^)]+)\)/g;
  const pattern2 = /(\d+)\.\s*\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern1.exec(text)) !== null) {
    map[m[1]] = { title: m[2].trim(), url: m[3].trim() };
  }
  while ((m = pattern2.exec(text)) !== null) {
    map[m[1]] = { title: m[2].trim(), url: m[3].trim() };
  }
  return map;
}

function extractFollowUps(text: string): { body: string; followUps: string[] } {
  const pattern = /---\s*\n\*?\*?Related Questions\*?\*?\s*\n([\s\S]*?)$/i;
  const match = text.match(pattern);
  if (match) {
    const body = text.slice(0, match.index).trim();
    const questions = match[1]
      .split('\n')
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter((l) => l.length > 0 && l.endsWith('?'));
    if (questions.length > 0) return { body, followUps: questions };
  }
  return { body: text, followUps: [] };
}

function extractSourcesSection(text: string): { body: string; sourcesSection: string } {
  const pattern = new RegExp(
    '(?:###|##)\\s*(?:Sources|Resources)\\s*\\n([\\s\\S]*?)(?=\\n---|\\n(?:###|##)\\s+|\\n\\*\\*Related Questions|$)',
    'i',
  );
  const match = text.match(pattern);
  if (match && match.index !== undefined) {
    const body = text.slice(0, match.index).trim();
    const rest = text.slice(match.index + match[0].length).trim();
    return { body: body + (rest ? '\n' + rest : ''), sourcesSection: match[1].trim() };
  }
  return { body: text, sourcesSection: '' };
}

function renderInline(
  text: string,
  key: string = '0',
  sourceMap: Record<string, { title: string; url: string }> = {},
  stylesObj: ReturnType<typeof StyleSheet.create>,
  isChat: boolean = false
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  // Remove inline citation numbers like [1], [2] from chat text - they'll be shown in sources section only
  const cleanedText = isChat ? text.replace(/\[\d+\]/g, '') : text;
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)/g;
  let lastIndex = 0;
  let idx = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleanedText)) !== null) {
    const m = match;
    if (m.index > lastIndex) {
      elements.push(<Text key={`${key}-t${idx}`} style={stylesObj.text}>{cleanedText.slice(lastIndex, m.index)}</Text>);
      idx++;
    }
    if (m[2]) {
      elements.push(<Text key={`${key}-b${idx}`} style={stylesObj.bold}>{m[2]}</Text>);
    } else if (m[4]) {
      elements.push(<Text key={`${key}-i${idx}`} style={stylesObj.italic}>{m[4]}</Text>);
    } else if (m[6] && m[7]) {
      // In chat mode, skip rendering source links - they'll only appear in Sources section
      const isSourceLink = Object.values(sourceMap).some(s => s.url === m[7] || s.title === m[6]);
      if (!isChat || !isSourceLink) {
        elements.push(<Text key={`${key}-l${idx}`} style={stylesObj.link} onPress={() => safeOpenUrl(m[7])}>{m[6]}</Text>);
      }
    } else if (m[9]) {
      elements.push(<Text key={`${key}-c${idx}`} style={stylesObj.inlineCode}>{m[9]}</Text>);
    }
    lastIndex = m.index + m[0].length;
    idx++;
  }
  if (lastIndex < cleanedText.length) {
    elements.push(<Text key={`${key}-rest`} style={stylesObj.text}>{cleanedText.slice(lastIndex)}</Text>);
  }
  return elements.length > 0 ? elements : [<Text key={`${key}-full`} style={stylesObj.text}>{cleanedText}</Text>];
}

export default function MarkdownRenderer({ content, onFollowUp, variant = 'default', articles, onArticlePress }: Props) {
  const isChat = variant === 'chat';
  const primaryLight = isChat ? '#FFFFFF' : COLORS.primaryLight;
  const primary = isChat ? '#FFFFFF' : COLORS.primary;
  const secondary = isChat ? '#FFFFFF' : COLORS.secondary;
  const tertiary = isChat ? '#E5E7EB' : COLORS.tertiary;
  const border = isChat ? '#FFFFFF' : COLORS.border;
  const borderLight = isChat ? '#FFFFFF' : COLORS.borderLight;
  const inlineLink = isChat ? '#FFFFFF' : '#2563EB';
  const inlineCodeBg = isChat ? '#111827' : '#F3F4F6';
  const codeTextColor = isChat ? '#FFFFFF' : '#D4D4D4';
  const linkColor = isChat ? '#FFFFFF' : '#2563EB';

  const styles = StyleSheet.create({
    container: {},
    spacer: { height: 6 },
    text: { fontSize: SIZES.base, color: primaryLight, lineHeight: 24, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular },
    bold: { fontSize: SIZES.base, color: primary, fontWeight: '400', fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, lineHeight: 24 },
    italic: { fontSize: SIZES.base, color: primaryLight, fontStyle: 'italic', fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, lineHeight: 24 },
    link: { fontSize: SIZES.base, color: linkColor, textDecorationLine: 'underline', fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, lineHeight: 24 },
    inlineCode: { backgroundColor: inlineCodeBg, fontFamily: 'monospace', paddingHorizontal: 4, borderRadius: 3, color: codeTextColor },
    citationBadge: { fontSize: 9, fontWeight: '400', fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, color: primaryLight, backgroundColor: inlineCodeBg, borderRadius: 10, width: 20, height: 20, textAlign: 'center', lineHeight: 20, marginHorizontal: 1, borderWidth: 1, borderColor: borderLight },
    citationBadgeInert: { fontSize: 9, fontWeight: '400', fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, color: tertiary, backgroundColor: inlineCodeBg, borderRadius: 10, width: 20, height: 20, textAlign: 'center', lineHeight: 20, marginHorizontal: 1, borderWidth: 1, borderColor: borderLight },
    h1: { fontSize: 22, fontWeight: '400', color: primary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, marginTop: 12, marginBottom: 6, lineHeight: 30 },
    h2: { fontSize: 19, fontWeight: '400', color: primary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, marginTop: 10, marginBottom: 4, lineHeight: 27 },
    h3: { fontSize: 16, fontWeight: '400', color: primary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, marginTop: 8, marginBottom: 3, lineHeight: 24 },
    paragraph: { fontSize: SIZES.base, color: primaryLight, lineHeight: 24, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, marginBottom: 4 },
    listItem: { flexDirection: 'row', paddingLeft: 4, marginBottom: 4 },
    bullet: { fontSize: SIZES.base, color: secondary, width: 16, lineHeight: 24, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular },
    listNum: { fontSize: SIZES.base, color: secondary, width: 20, lineHeight: 24, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold },
    listText: { flex: 1, fontSize: SIZES.base, color: primaryLight, lineHeight: 24, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular },
    blockquote: { borderLeftWidth: 3, borderLeftColor: COLORS.warning, backgroundColor: isChat ? '#0B1220' : '#FFF8E1', paddingLeft: 12, paddingVertical: 8, paddingRight: 8, borderRadius: 4, marginVertical: 6 },
    blockquoteText: { fontSize: SIZES.base, color: primaryLight, lineHeight: 22, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular },
    codeBlock: { backgroundColor: '#1E1E1E', borderRadius: 8, padding: 12, marginVertical: 6 },
    codeText: { fontSize: 13, color: codeTextColor, fontFamily: 'monospace', lineHeight: 20 },
    hr: { height: 1, backgroundColor: border, marginVertical: 12 },
    sourcesSection: { marginTop: 12 },
    sectionTitle: { fontSize: 12, fontWeight: '400', color: isChat ? '#9CA3AF' : secondary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    sourceChip: { 
      marginBottom: 8, 
      backgroundColor: isChat ? '#E5E7EB' : '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderLeftWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sourceNumber: { width: 26, fontSize: 13, color: '#6B7280', fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, fontWeight: '700', lineHeight: 18 },
    sourceCardTitle: { fontSize: 13, color: isChat ? '#111827' : primary, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, lineHeight: 18, flex: 1 },
    followUpSection: { marginTop: 12, backgroundColor: isChat ? '#0B1220' : '#F5F5F5', borderRadius: 12, padding: 12 },
    followUpBtn: { backgroundColor: isChat ? '#1F2937' : '#FFFFFF', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6 },
    followUpText: { fontSize: SIZES.sm, color: primary, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, lineHeight: 18 },
    articlesSection: { marginTop: 12 },
    articleCard: { backgroundColor: isChat ? '#1F2937' : '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
    articleTitle: { fontSize: 14, color: primary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, lineHeight: 20, marginBottom: 4 },
    articleSummary: { fontSize: 12, color: secondary, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, lineHeight: 18 },
    articleCategory: { fontSize: 10, color: COLORS.primary, fontFamily: isChat ? 'HelveticaNeue' : FONTS.bold, marginBottom: 6, textTransform: 'uppercase' },
    articleReadMore: { fontSize: 11, color: linkColor, fontFamily: isChat ? 'HelveticaNeue-Light' : FONTS.regular, marginTop: 8 },
  });
  const cleaned = stripSeverityTag(content);
  const sourceMap = extractSourceMap(cleaned);
  const { body: bodyNoSources, sourcesSection } = extractSourcesSection(cleaned);
  // We intentionally strip “Related Questions” from the rendered markdown
  // so the chat screen can show dedicated top prompts instead.
  const { body, followUps } = extractFollowUps(bodyNoSources);

  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<View key={`sp-${i}`} style={styles.spacer} />);
      i++;
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<View key={`hr-${i}`} style={styles.hr} />);
      i++;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(<View key={`code-${i}`} style={styles.codeBlock}><Text style={styles.codeText}>{codeLines.join('\n')}</Text></View>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<Text key={`h3-${i}`} style={styles.h3}>{renderInline(trimmed.slice(4), `h3i-${i}`, sourceMap, styles, isChat)}</Text>);
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<Text key={`h2-${i}`} style={styles.h2}>{renderInline(trimmed.slice(3), `h2i-${i}`, sourceMap, styles, isChat)}</Text>);
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<Text key={`h1-${i}`} style={styles.h1}>{renderInline(trimmed.slice(2), `h1i-${i}`, sourceMap, styles, isChat)}</Text>);
      i++;
      continue;
    }
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(<View key={`bq-${i}`} style={styles.blockquote}><Text style={styles.blockquoteText}>{renderInline(quoteLines.join(' '), `bqi-${i}`, sourceMap, styles, isChat)}</Text></View>);
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1] || '1';
      const txt = trimmed.replace(/^\d+\.\s/, '');
      elements.push(<View key={`ol-${i}`} style={styles.listItem}><Text style={styles.listNum}>{num}.</Text><Text style={styles.listText}>{renderInline(txt, `oli-${i}`, sourceMap, styles, isChat)}</Text></View>);
      i++;
      continue;
    }
    if (/^[-*•]\s/.test(trimmed)) {
      const txt = trimmed.replace(/^[-*•]\s/, '');
      elements.push(<View key={`ul-${i}`} style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.listText}>{renderInline(txt, `uli-${i}`, sourceMap, styles, isChat)}</Text></View>);
      i++;
      continue;
    }
    elements.push(<Text key={`p-${i}`} style={styles.paragraph}>{renderInline(trimmed, `pi-${i}`, sourceMap, styles, isChat)}</Text>);
    i++;
  }

  const sourceEntries = Object.entries(sourceMap)
    .map(([id, source]) => ({
      id,
      source,
      score: scoreMedicalSource(source.url, source.title),
    }))
    .filter((x) => x.score >= 60);

  return (
    <View style={styles.container}>
      {elements}
      {/* Sources section - clickable cards with name only */}
      {sourceEntries.length > 0 && (
        <View style={styles.sourcesSection}>
          <Text style={styles.sectionTitle}>Resources</Text>
          {sourceEntries.map(({ id, source }, idx) => (
            <TouchableOpacity 
              key={`src-${id}`} 
              style={styles.sourceChip}
              onPress={() => safeOpenUrl(source.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.sourceNumber}>{idx + 1}.</Text>
              <Text style={styles.sourceCardTitle} numberOfLines={2}>
                {source.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Related Questions section - after sources */}
      {followUps.length > 0 && (
        <View style={styles.followUpSection}>
          <Text style={styles.sectionTitle}>Related Questions</Text>
          {followUps.map((q, idx) => (
            <TouchableOpacity key={idx} style={styles.followUpBtn} onPress={() => onFollowUp?.(q)} activeOpacity={0.7}>
              <Text style={styles.followUpText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Article Cards section */}
      {articles && articles.length > 0 && (
        <View style={styles.articlesSection}>
          <Text style={styles.sectionTitle}>Recommended Articles</Text>
          {articles.map((article, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.articleCard}
              onPress={() => onArticlePress?.(article)}
              activeOpacity={0.7}
            >
              {article.category && (
                <Text style={styles.articleCategory}>{article.category}</Text>
              )}
              <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
              {article.summary && (
                <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
              )}
              <Text style={styles.articleReadMore}>Tap to read more →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// (styles moved inside the component to support variant-based theming)
