/**
 * Bible verse widget — random King James Version verse per run.
 * No user key required (server fetches from bible-api.com).
 */
import { fetchJson, buildQuery } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const VERSES = [
  'Genesis 1:1','Genesis 1:26','Genesis 28:15','Exodus 14:14','Exodus 20:3',
  'Numbers 6:24','Deuteronomy 31:6','Joshua 1:9','Judges 6:12','Ruth 1:16',
  '1 Samuel 16:7','2 Samuel 22:3','1 Kings 8:56','2 Kings 6:16','1 Chronicles 16:34',
  '2 Chronicles 7:14','Ezra 8:22','Nehemiah 8:10','Esther 4:14','Job 19:25',
  'Psalm 1:1','Psalm 23:1','Psalm 27:1','Psalm 34:8','Psalm 37:4',
  'Psalm 46:1','Psalm 46:10','Psalm 55:22','Psalm 91:1','Psalm 91:11',
  'Psalm 100:4','Psalm 103:12','Psalm 107:1','Psalm 118:24','Psalm 119:105',
  'Psalm 121:1','Psalm 139:14','Psalm 145:18','Proverbs 3:5','Proverbs 3:6',
  'Proverbs 4:23','Proverbs 16:3','Proverbs 16:9','Proverbs 17:17','Proverbs 18:10',
  'Proverbs 22:6','Proverbs 31:25','Ecclesiastes 3:1','Isaiah 26:3','Isaiah 40:28',
  'Isaiah 40:29','Isaiah 40:31','Isaiah 41:10','Isaiah 43:2','Isaiah 53:5',
  'Isaiah 55:8','Isaiah 55:11','Isaiah 64:8','Jeremiah 17:7','Jeremiah 29:11',
  'Jeremiah 31:3','Lamentations 3:22','Lamentations 3:23','Ezekiel 36:26','Daniel 2:22',
  'Hosea 6:3','Joel 2:25','Amos 5:24','Micah 6:8','Nahum 1:7',
  'Habakkuk 2:4','Zephaniah 3:17','Haggai 2:4','Zechariah 4:6','Malachi 3:10',
  'Matthew 5:3','Matthew 5:16','Matthew 6:33','Matthew 7:7','Matthew 11:28',
  'Matthew 22:37','Matthew 22:39','Matthew 28:19','Matthew 28:20','Mark 10:45',
  'Mark 11:24','Luke 1:37','Luke 6:38','Luke 10:27','Luke 12:31',
  'John 1:1','John 1:14','John 3:16','John 3:17','John 6:35',
  'John 8:32','John 10:10','John 11:25','John 13:34','John 14:6',
  'John 14:27','John 15:5','John 15:13','John 16:33','John 17:17',
  'Acts 1:8','Acts 2:38','Acts 4:12','Romans 1:16','Romans 3:23',
  'Romans 5:8','Romans 6:23','Romans 8:1','Romans 8:28','Romans 8:38',
  'Romans 10:9','Romans 12:1','Romans 12:2','1 Corinthians 10:13','1 Corinthians 13:4',
  '1 Corinthians 13:13','1 Corinthians 15:57','2 Corinthians 4:17','2 Corinthians 5:7','2 Corinthians 5:17',
  '2 Corinthians 12:9','Galatians 2:20','Galatians 5:22','Ephesians 2:8','Ephesians 2:10',
  'Ephesians 3:20','Ephesians 6:10','Philippians 1:6','Philippians 4:6','Philippians 4:7',
  'Philippians 4:13','Philippians 4:19','Colossians 3:2','1 Thessalonians 5:16','1 Thessalonians 5:18',
  '2 Timothy 1:7','2 Timothy 3:16','Hebrews 4:16','Hebrews 11:1','Hebrews 11:6',
  'Hebrews 12:1','Hebrews 13:5','James 1:5','James 1:17','James 4:7',
  '1 Peter 2:9','1 Peter 5:7','2 Peter 1:3','1 John 1:9','1 John 4:8',
  '1 John 4:19','Revelation 3:20','Revelation 21:4','Revelation 22:13',
];

export default {
  id: 'bible',
  name: 'Word of the Day',
  requiredKeys: [],
  defaultEnabled: true,
  order: 10,

  async fetch() {
    const reference = VERSES[Math.floor(Math.random() * VERSES.length)];
    const query = buildQuery({ ref: reference });
    return fetchJson(`/api/bible?${query}`, 'Bible');
  },

  render(verse) {
    return `
      <div class="sitrep-section sitrep-verse">
        <div class="sitrep-section-title">${t('widget.bible.title')}</div>
        <div class="verse-text">&ldquo;${verse.text}&rdquo;</div>
        <div class="verse-reference">&mdash; ${verse.reference}</div>
      </div>
    `;
  }
};
