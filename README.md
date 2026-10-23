# 주헌 루틴 — 웹사이트 버전

하루 루틴 체크, 주간 시간표, 월간 일정·목표를 관리하는 개인 웹사이트입니다.
GitHub Pages에 올리면 `https://<GitHub아이디>.github.io/<저장소이름>/` 주소로 열립니다.

- Supabase를 연결하기 전: 그 브라우저에만 기록이 저장됩니다.
- Supabase를 연결한 뒤: 이메일 로그인 링크로 로그인하면 휴대폰과 PC 기록이 이어집니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 앱 화면과 기능 전체 |
| `backend.js` | 로그인과 Supabase 저장 연결 |
| `config.js` | Supabase 주소와 공개 키를 넣는 곳 |
| `site.css` | 로그인 화면 스타일 |
| `transfer.js` | 기록 가져오기·내보내기, 첫 실행 때 기존 기록 넣기 |
| `seed.js` | claude.ai 앱에서 옮긴 기존 기록 |
| `supabase-schema.sql` | Supabase에 기록용 표를 만드는 SQL |

## 1. GitHub Pages에 올리기 (약 5분)

1. https://github.com 에 로그인하고 오른쪽 위 **+ → New repository** 를 누릅니다.
2. 이름은 예를 들어 `routine`, **Public** 으로 두고 **Create repository** 를 누릅니다.
3. 생성된 페이지에서 **uploading an existing file** 링크를 누르고, 이 `site` 폴더 안의 파일을 전부 끌어다 놓은 뒤 **Commit changes** 를 누릅니다.
4. 저장소의 **Settings → Pages** 에서 Source를 **Deploy from a branch**, Branch를 **main / (root)** 로 고르고 **Save** 를 누릅니다.
5. 1~2분 뒤 같은 화면 위쪽에 `https://<아이디>.github.io/routine/` 주소가 뜹니다. 이 주소가 웹사이트입니다.

## 2. 기기 간 동기화 켜기: Supabase (약 10분, 무료)

1. https://supabase.com 에서 가입하고 **New project** 를 만듭니다. 지역은 Northeast Asia (Seoul)를 추천합니다.
2. 왼쪽 메뉴 **SQL Editor → New query** 에 `supabase-schema.sql` 내용을 통째로 붙여 넣고 **Run** 을 누릅니다.
3. **Authentication → URL Configuration** 에서
   - **Site URL** 에 1단계의 주소(`https://<아이디>.github.io/routine/`)를 넣고,
   - **Redirect URLs** 에도 같은 주소를 추가합니다.
4. **Project Settings → API** 에서 **Project URL** 과 **anon public** 키를 복사합니다.
5. GitHub 저장소에서 `config.js` 를 열고 연필 아이콘(Edit)을 눌러 두 값을 넣은 뒤 **Commit changes** 를 누릅니다.

   ```js
   window.ROUTINE_CONFIG = {
     supabaseUrl: "https://abcdxyz.supabase.co",
     supabaseAnonKey: "eyJhbGciOi..."
   };
   ```

6. 1~2분 뒤 웹사이트를 새로고침하면 로그인 화면이 나옵니다. 이메일을 넣고 메일로 온 링크를 누르면 시작됩니다.
7. (권장) 처음 로그인한 뒤 **Authentication → Sign In / Providers** 에서 **Allow new users to sign up** 을 끄면, 다른 사람이 이 사이트로 가입하지 못합니다.

anon public 키는 원래 공개되는 키라 GitHub에 올려도 괜찮습니다. 기록은 표의 보안 규칙 때문에 로그인한 본인만 읽고 쓸 수 있습니다.
**service_role** 키는 절대 넣지 마세요.

## 3. 기존 기록 (자동으로 들어가요)

`seed.js` 에 claude.ai 앱에서 옮긴 기록(루틴, 체크, 회고, 주간·월간 일정, 목표)이 들어 있습니다.
사이트를 처음 열었을 때 기록이 비어 있으면 한 번만 자동으로 불러옵니다. 로그인해서 동기화를 쓰면 그 계정에도 한 번 들어갑니다.

**주의:** GitHub 무료 계정의 Pages는 공개 저장소라서, `seed.js` 를 올리면 그 안의 회고와 일정도 누구나 볼 수 있습니다.
기록이 사이트에 한 번 들어간 뒤에는 GitHub에서 `seed.js` 를 지우는 것을 권합니다(지워도 사이트는 정상 동작).
`seed.js` 를 아예 올리고 싶지 않다면, 같은 기록이 담긴 `juheon-routine-data.json`(이 폴더 바깥)을
**오늘** 탭의 **기록 옮기기 → 기록 가져오기**로 직접 불러오면 됩니다.

같은 카드의 **파일로 내보내기**로 언제든 백업 파일을 만들 수 있습니다.

## 참고

- 다른 기기에서 바꾼 내용은 이 탭으로 돌아오거나 새로고침하면 반영됩니다.
- claude.ai 링크 버전의 기록은 이 사이트로 자동으로 옮겨지지 않습니다.
- 앱을 고친 뒤에는 상위 폴더의 `build-site.sh` 로 `index.html` 을 다시 만들고, 바뀐 `index.html` 만 GitHub에 다시 올리면 됩니다.
