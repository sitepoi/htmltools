"""
Generate a standalone test harness HTML file for Matchmaking.
Reads all three source files and bundles them with a mock tool SDK.
"""
import os
import json

BASE = r'd:\PROJECTS\UNICONHUB\CODE\HTMLBasedTools\Matchmaking'

# Read source files
with open(os.path.join(BASE, 'Matchmaking.html'), 'r', encoding='utf-8') as f:
    html_body = f.read()

with open(os.path.join(BASE, 'Matchmaking.css'), 'r', encoding='utf-8') as f:
    css = f.read()

with open(os.path.join(BASE, 'Matchmaking.js'), 'r', encoding='utf-8') as f:
    js = f.read()

# Escape </script> sequences that would break the HTML <script> tag
js = js.replace('</script>', '<\\/script>')
js = js.replace('</Script>', '<\\/Script>')
js = js.replace('</SCRIPT>', '<\\/SCRIPT>')

# Build the mock tool SDK
mock_sdk = """<script>
/* ── Mock tool SDK for local testing ── */
(function() {
  var STORAGE_KEY = 'matchmaking_test_db';
  var listeners = { valueChange: [], fieldsChange: [], readonlyChange: [], userChange: [] };
  var _readOnly = false, _user = null, _fields = {}, _value = null;
  var _aiEnabled = true, _uploadEnabled = true;

  function load() {
    try { var raw = localStorage.getItem(STORAGE_KEY); _value = raw ? JSON.parse(raw) : null; }
    catch(e) { _value = null; }
  }
  function save(v) { _value = v; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch(e) {} }

  window.tool = {
    // Value
    getValue: function() { return _value; },
    setValue: function(data) { save(data); listeners.valueChange.forEach(function(cb) { try { cb(data); } catch(e) {} }); },
    onValueChange: function(cb) { listeners.valueChange.push(cb); },

    // Fields
    getFields: function() { return Object.assign({}, _fields); },
    setField: function(id, value) { _fields[id] = value; },
    setFields: function(obj) { Object.assign(_fields, obj); },
    watchField: function(id, cb) { listeners.fieldsChange.push(cb); },
    onFieldsChange: function(cb) { listeners.fieldsChange.push(cb); },

    // Params
    param: function(name, fallback) {
      var p = (new URLSearchParams(window.location.search)).get(name);
      if (p !== null && p !== '') {
        if (p === 'true' || p === 'false') return p;
        return p;
      }
      // Check local overrides
      if (name === 'allowAi' && !_aiEnabled) return 'no';
      if (name === 'allowUpload' && !_uploadEnabled) return 'no';
      return fallback !== undefined ? fallback : '';
    },

    // Read-only
    isReadOnly: function() { return _readOnly; },
    onReadonlyChange: function(cb) { listeners.readonlyChange.push(cb); },

    // User
    getUser: function() { return _user; },
    onUserChange: function(cb) { listeners.userChange.push(cb); },

    // Validation
    reportValid: function(bool, msg) {
      if (!bool) console.warn('[Matchmaking Validation]', msg);
    },

    // Notifications
    notify: function(message, severity) {
      severity = severity || 'info';
      var colors = { info: '#7c3aed', success: '#16a34a', warning: '#d97706', error: '#dc2626' };
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:' + (colors[severity] || '#333') + ';color:#fff;padding:10px 20px;border-radius:6px;font-family:system-ui;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:toolFadeIn .3s ease;max-width:400px;';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
    },

    // Layout
    resize: function() {},

    // Schema
    declareOutput: function() {},
    declareParams: function() {},

    // AI Relay (mock)
    requestAI: function(prompt, context, callback) {
      if (!_aiEnabled) {
        callback('AI matching is not enabled (allowAi: no)', null);
        return;
      }
      console.log('[Mock AI] Prompt length:', prompt.length, 'Context length:', context.length);
      // Simulate AI response with a delay
      setTimeout(function() {
        // Parse the candidates from the prompt and generate mock AI scores
        var codes = [];
        var regex = /Code: (ADAY-[MF]\\d{3})/g;
        var match;
        while ((match = regex.exec(prompt)) !== null) {
          if (codes.indexOf(match[1]) === -1) codes.push(match[1]);
        }
        // Skip the primary candidate (first one)
        var targetCodes = codes.slice(1, Math.min(11, codes.length));

        var results = [];
        for (var i = 0; i < targetCodes.length; i++) {
          results.push({
            code: targetCodes[i],
            aiScore: Math.floor(Math.random() * 35) + 55, // 55-89
            aiReasoning: 'Değer yargıları ve hayat felsefesi açısından uyumlu. Evlilik beklentileri ve aile anlayışı paralellik gösteriyor. Karakter özellikleri birbirini tamamlayıcı nitelikte.'
          });
        }
        results.sort(function(a, b) { return b.aiScore - a.aiScore; });
        callback(null, JSON.stringify(results));
      }, 1500 + Math.random() * 1500);
    },

    // Upload (mock)
    requestUpload: function(accept, callback) {
      if (!_uploadEnabled) {
        callback('File upload is not enabled (allowUpload: no)', null);
        return;
      }
      // Create a file input and trigger it
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = function() {
        var file = input.files[0];
        if (!file) {
          callback('No file selected', null);
          return;
        }
        // Create a mock file response
        var mockFile = {
          name: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          type: file.type || 'application/octet-stream'
        };
        callback(null, mockFile);
      };
      input.click();
    },

    // File Content (mock)
    requestFileContent: function(url, callback) {
      callback(null, '[Mock file content - text extraction not available in test harness]');
    },

    // Init
    onReady: function(cb) { load(); cb(_value, _fields); },

    // Test harness helpers
    _setReadOnly: function(v) {
      _readOnly = v;
      listeners.readonlyChange.forEach(function(cb) { try { cb(v); } catch(e) {} });
    },
    _loadSampleData: function(data) { save(data); window.location.reload(); },
    _clearData: function() { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
    _toggleReadOnly: function() { this._setReadOnly(!_readOnly); },
    _toggleAI: function() { _aiEnabled = !_aiEnabled; return _aiEnabled; },
    _toggleUpload: function() { _uploadEnabled = !_uploadEnabled; return _uploadEnabled; },
    _dump: function() { console.log('Matchmaking DB:', JSON.parse(JSON.stringify(_value))); }
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') { e.preventDefault(); window.tool._toggleReadOnly(); window.tool.notify(window.tool.isReadOnly() ? 'READ-ONLY MODE' : 'EDIT MODE', 'info'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); window.tool._dump(); window.tool.notify('DB dumped to console', 'info'); }
  });
})();
</script>"""

# Sample data
sample_data_script = """<script>
/* ── Sample Data ── */
var SAMPLE_DATA = {
  candidates: [
    {
      id: "cand-sample-m1",
      code: "ADAY-M001",
      gender: "male",
      fullname: "Ahmet Yılmaz",
      location: "Kanada, Toronto",
      contact: "+1 (416) 555-0101",
      consultant: "Danışman A",
      refName: "Mehmet Demir",
      refPhone: "+1 (416) 555-0201",
      refLocation: "Kanada, Toronto",
      birthDate: "1995-03-15",
      birthReal: "",
      birthPlace: "İstanbul, Türkiye",
      age: 31,
      nativeLang: "Türkçe",
      otherLangs: "İngilizce - İleri, Arapça - Orta",
      motherInfo: "Ayşe Yılmaz, İstanbul, Ev Hanımı, Toronto, Ev Hanımı",
      fatherInfo: "Mustafa Yılmaz, Konya, İşletme Sahibi, Toronto, Emekli",
      siblingsTotal: "3",
      siblingsBrothers: "1",
      siblingsSisters: "2",
      siblingRank: "En büyük",
      education: "İstanbul Teknik Üniversitesi, Bilgisayar Mühendisliği, 2013-2017. Toronto'da yazılım geliştirici olarak çalışıyor. 2019'dan beri Kanada'da.",
      hobbies: "Doğa yürüyüşleri, fotoğrafçılık, kitap okuma, yüzme, bisiklet sürme, satranç",
      artistic: "Fotoğrafçılık, amatör düzeyde gitar çalma",
      media: "Belgesel ve tarih dizilerini sever. TRT Belgesel, National Geographic takip eder.",
      prayer: "5 vakit namazı düzenli kılmaya çalışıyorum. Bazen iş yoğunluğunda aksatabiliyorum ama telafi ediyorum.",
      reading: "Düzenli kitap okurum. Tarih, felsefe ve kişisel gelişim kitaplarını tercih ederim. En çok etkilendiğim kitap: 'Beyaz Zambaklar Ülkesinde'.",
      roleModels: "Dedem, üniversite hocam Prof. Dr. Ali Bey",
      volunteering: "Haftalık sohbet grubunda düzenli katılımcıyım. Gençlere mentorluk yapıyorum.",
      personality: "Sakin, sabırlı, düşünceli ve planlı biriyim. İnsanlarla kolay iletişim kurarım.",
      redlines: "Yalan söylenmesi, güvenin sarsılması, saygısızlık benim için kabul edilemez.",
      genderRelations: "Saygı ve mesafe çerçevesinde, ciddi niyetle yaklaşırım.",
      strengthsWeaknesses: "Güçlü: Sabırlı, çalışkan, güvenilir. Zayıf: Bazen fazla detaycı olabiliyorum.",
      values: "Dürüstlük, güven, aile bağları, sadakat, merhamet en önemli değerlerimdir.",
      decisionMaking: "İstişare ederim, artı ve eksileri değerlendiririm, sonra karar veririm.",
      importantPeople: "Annem, babam ve kardeşlerim hayatımda çok önemli.",
      marriageExpectations: "1. Karşılıklı saygı ve sevgi\\n2. Güven ve sadakat\\n3. Huzurlu bir yuva kurmak\\n4. Birbirini desteklemek\\n5. Aile değerlerini yaşatmak",
      marriageEffort: "Katılıyorum. Emek; sabır, anlayış, fedakarlık ve sürekli iletişim demektir.",
      spouseRedlines: "Dini vecibelerini yerine getiren, ahlaklı ve dürüst olmalı.",
      spouseYellowlines: "Eğitim seviyesi, şehir tercihi",
      spouseGreen: "Ahlaklı, merhametli, aile değerlerine önem veren, kitap okumayı seven, doğayı seven",
      spouseSocialMedia: "Sosyal medyada aktif olması sorun değil, ama mahremiyete dikkat etmeli.",
      ageMin: 24,
      ageMax: 32,
      spousePast: "Geçmişte resmi olmayan kısa süreli bir görüşme olabilir. Resmi evlilik geçirmemiş olmasını tercih ederim.",
      familyRole: "Ailemin fikri önemli ama son karar benim. Onaylamalarını isterim.",
      relocationView: "Gerekirse şehir değiştirmeye açığım. Kanada içinde her şehir olabilir.",
      residencyStatus: "Kanada vatandaşı",
      currentHousing: "Tek başıma kiralık dairede",
      futureHousing: "Evlilik sonrası Toronto'da müstakil bir evde yaşamayı planlıyorum.",
      incomeSource: "Yazılım geliştirici olarak tam zamanlı çalışıyorum.",
      careerPlans: "Kariyerimde ilerlemek, belki kendi yazılım şirketimi kurmak istiyorum.",
      budgetViews: "Ortak bütçe yapılmalı, gelir gider dengesi korunmalı.",
      financialFuture: "Uzun vadede ev sahibi olmayı hedefliyorum. Konforlu ama israftan uzak bir yaşam tarzı.",
      pastRelationships: "Bir kez kısa süreli görüşme oldu.",
      currentInterest: "Şu an hayatımda kimse yok.",
      additionalNotes: "Aile fotoğrafı eklemek isterim.",
      height: 180,
      weight: 78,
      eyeColor: "Kahverengi",
      hair: "Siyah, düz",
      files: [],
      createdAt: "2025-10-01",
      updatedAt: "2025-10-01"
    },
    {
      id: "cand-sample-m2",
      code: "ADAY-M002",
      gender: "male",
      fullname: "Mehmet Kaya",
      location: "Kanada, Vancouver",
      contact: "+1 (604) 555-0301",
      consultant: "Danışman B",
      refName: "Ali Yıldız",
      refPhone: "+1 (604) 555-0401",
      refLocation: "Kanada, Vancouver",
      birthDate: "1992-07-22",
      birthReal: "",
      birthPlace: "Ankara, Türkiye",
      age: 33,
      nativeLang: "Türkçe",
      otherLangs: "İngilizce - İleri, Fransızca - Başlangıç",
      motherInfo: "Fatma Kaya, Ankara, Öğretmen, Vancouver, Emekli",
      fatherInfo: "Hasan Kaya, Ankara, Mühendis, Vancouver, Emekli",
      siblingsTotal: "2",
      siblingsBrothers: "1",
      siblingsSisters: "1",
      siblingRank: "Ortanca",
      education: "ODTÜ Makine Mühendisliği 2010-2015. Vancouver'da mühendis olarak çalışıyor.",
      hobbies: "Futbol, koşu, kamp, seyahat, yemek yapma",
      artistic: "Bağlama çalıyorum, amatör düzeyde.",
      media: "Spor programları, komedi dizileri.",
      prayer: "Düzenli kılmaya gayret ediyorum. Cemaatle kılmayı severim.",
      reading: "Ayda 2-3 kitap okurum. Tarih ve macera romanlarını severim.",
      roleModels: "Babam ve üniversite hocam.",
      volunteering: "Haftalık sohbet grubunda aktifim. Gençlik kampı organizasyonlarında gönüllüyüm.",
      personality: "Sosyal, neşeli, enerjik. İnsanlarla vakit geçirmeyi severim.",
      redlines: "Güvensizlik, samimiyetsizlik, dini hassasiyetlere saygısızlık.",
      genderRelations: "Ciddi ve saygılı yaklaşırım. Aile tanışması olmadan ilerlemem.",
      strengthsWeaknesses: "Güçlü: Enerjik, sosyal, yardımsever. Zayıf: Bazen sabırsız olabiliyorum.",
      values: "İslami değerler, aile, dostluk, yardımlaşma, adalet.",
      decisionMaking: "Aileme danışırım, mantıklı değerlendiririm.",
      importantPeople: "Ailem ve yakın arkadaşlarım.",
      marriageExpectations: "1. İslami değerler çerçevesinde bir yuva\\n2. Karşılıklı sevgi ve saygı\\n3. Huzur ve mutluluk\\n4. Çocuk yetiştirmek\\n5. Birlikte ibadet edebilmek",
      marriageEffort: "Kesinlikle katılıyorum. Emek; anlayış, fedakarlık ve sürekli kendini yenilemektir.",
      spouseRedlines: "Dini hassasiyeti olan, namazını kılan, ahlaklı.",
      spouseYellowlines: "Eğitim durumu, meslek.",
      spouseGreen: "Neşeli, sosyal, seyahat etmeyi seven, çocukları seven, sportif.",
      spouseSocialMedia: "Çok fazla aktif olmasını tercih etmem, mahremiyet önemli.",
      ageMin: 23,
      ageMax: 31,
      spousePast: "Geçmiş ilişkisi olmamış olmasını tercih ederim.",
      familyRole: "Ailemin onayı benim için çok önemli, ortak karar alırız.",
      relocationView: "Vancouver'da yaşamayı tercih ederim ama Toronto'ya da açığım.",
      residencyStatus: "Kanada PR",
      currentHousing: "Arkadaşla paylaşımlı ev",
      futureHousing: "Evlilik sonrası Vancouver'da müstakil ev.",
      incomeSource: "Tam zamanlı mühendis.",
      careerPlans: "Proje yöneticisi olmak istiyorum.",
      budgetViews: "Dengeli bütçe, birikim yapılmalı.",
      financialFuture: "Ev sahibi olmak, çocukların eğitimi için birikim.",
      pastRelationships: "Yok.",
      currentInterest: "Yok.",
      additionalNotes: "",
      height: 175,
      weight: 72,
      eyeColor: "Ela",
      hair: "Kahverengi, dalgalı",
      files: [],
      createdAt: "2025-10-05",
      updatedAt: "2025-10-05"
    },
    {
      id: "cand-sample-f1",
      code: "ADAY-F001",
      gender: "female",
      fullname: "Zeynep Demir",
      location: "Kanada, Toronto",
      contact: "+1 (416) 555-0501",
      consultant: "Danışman A",
      refName: "Hatice Şahin",
      refPhone: "+1 (416) 555-0601",
      refLocation: "Kanada, Toronto",
      birthDate: "1997-01-10",
      birthReal: "",
      birthPlace: "Bursa, Türkiye",
      age: 29,
      nativeLang: "Türkçe",
      otherLangs: "İngilizce - İleri, Arapça - Orta",
      motherInfo: "Emine Demir, Bursa, Ev Hanımı, Toronto, Ev Hanımı",
      fatherInfo: "İbrahim Demir, Bursa, Doktor, Toronto, Doktor",
      siblingsTotal: "4",
      siblingsBrothers: "2",
      siblingsSisters: "2",
      siblingRank: "3. çocuk",
      education: "Toronto Üniversitesi, Psikoloji, 2015-2019.Şu anda okul danışmanı olarak çalışıyor.",
      hobbies: "Kitap okuma, yoga, yürüyüş, resim yapma, gönüllü çalışmalar, yemek yapma",
      artistic: "Suluboya resim, hat sanatı öğreniyorum.",
      media: "Dram ve romantik komedi filmlerini severim. Psikoloji podcastleri dinlerim.",
      prayer: "5 vakit namazımı düzenli kılmaya çalışıyorum, hamdolsun.",
      reading: "Çok okurum. Psikoloji, kişisel gelişim, İslami kitaplar ve roman okurum. 'İnsanın Anlam Arayışı' beni çok etkiledi.",
      roleModels: "Annem, bir hocam, ve bazı İslam alimleri.",
      volunteering: "Haftalık sohbet grubunda aktifim. Genç kızlara mentorluk yapıyorum. Mülteci ailelere destek programında gönüllüyüm.",
      personality: "Sakin, anlayışlı, empati yeteneği yüksek, detaycı, duygusal ama mantıklı.",
      redlines: "Yalan, aldatma, saygısızlık, dini değerlere önem vermeyen.",
      genderRelations: "Ciddi ve saygılı. Ailemin bilgisi dahilinde ilerlerim.",
      strengthsWeaknesses: "Güçlü: Empati, sabır, düzenli. Zayıf: Bazen fazla duygusal olabiliyorum.",
      values: "İslam, aile, dürüstlük, merhamet, adalet, sadakat.",
      decisionMaking: "İstişare ederim, mantıklı ve duygusal denge kurarım.",
      importantPeople: "Ailem, özellikle annem.",
      marriageExpectations: "1. İslami temeller üzerine kurulu bir yuva\\n2. Karşılıklı sevgi, saygı ve güven\\n3. Manevi gelişimi destekleyen bir eş\\n4. Huzurlu ve güvenli bir aile ortamı\\n5. Çocukları İslami değerlerle yetiştirmek",
      marriageEffort: "Tamamen katılıyorum. Emek; sabır, anlayış, fedakarlık, sürekli iletişim ve karşılıklı gelişim demektir.",
      spouseRedlines: "Dini hassasiyeti olan, namazını kılan, ahlaklı, dürüst, güvenilir olmalı.",
      spouseYellowlines: "Boy, yaş farkı, eğitim seviyesi.",
      spouseGreen: "Merhametli, anlayışlı, kitap okuyan, doğayı seven, aile bağları güçlü, çalışkan, pozitif.",
      spouseSocialMedia: "Sosyal medyada aşırı aktif olmasını tercih etmem. Ama tamamen kapalı olmasına da gerek yok.",
      ageMin: 28,
      ageMax: 36,
      spousePast: "Geçmişte ciddi bir ilişkisi olmamış olmasını tercih ederim.",
      familyRole: "Ailemin görüşü benim için önemli, onların onaylamasını isterim.",
      relocationView: "Toronto'da kalmayı tercih ederim ama eşimin durumuna göre değerlendiririm.",
      residencyStatus: "Kanada vatandaşı",
      currentHousing: "Ailemle birlikte",
      futureHousing: "Evlendikten sonra Toronto'da müstakil ev veya apartman dairesi.",
      incomeSource: "Okul danışmanı olarak tam zamanlı çalışıyorum.",
      careerPlans: "Klinik psikoloji alanında yüksek lisans yapmak istiyorum.",
      budgetViews: "Bütçe yönetimi önemli. İsraftan kaçınılmalı, birikim yapılmalı.",
      financialFuture: "Ev sahibi olmayı isterim. Konforlu ama mütevazı bir yaşam tarzı.",
      pastRelationships: "Yok.",
      currentInterest: "Yok.",
      additionalNotes: "",
      height: 165,
      weight: 58,
      eyeColor: "Kahverengi",
      hair: "Kumral, dalgalı",
      files: [],
      createdAt: "2025-10-10",
      updatedAt: "2025-10-10"
    },
    {
      id: "cand-sample-f2",
      code: "ADAY-F002",
      gender: "female",
      fullname: "Elif Yıldız",
      location: "Kanada, Vancouver",
      contact: "+1 (604) 555-0701",
      consultant: "Danışman B",
      refName: "Merve Aydın",
      refPhone: "+1 (604) 555-0801",
      refLocation: "Kanada, Vancouver",
      birthDate: "1994-05-18",
      birthReal: "",
      birthPlace: "İzmir, Türkiye",
      age: 32,
      nativeLang: "Türkçe",
      otherLangs: "İngilizce - İleri, İspanyolca - Orta",
      motherInfo: "Zehra Yıldız, İzmir, Hemşire, Vancouver, Emekli",
      fatherInfo: "Ömer Yıldız, İzmir, Avukat, Vancouver, Avukat",
      siblingsTotal: "2",
      siblingsBrothers: "0",
      siblingsSisters: "2",
      siblingRank: "En küçük",
      education: "Boğaziçi Üniversitesi İşletme 2012-2016. Vancouver'da finans sektöründe çalışıyor.",
      hobbies: "Seyahat, fotoğrafçılık, pilates, yemek yapma, gönüllü çalışmalar",
      artistic: "Piyano çalıyorum, amatör fotoğrafçılık.",
      media: "Romantik komedi, dram. Gezi programlarını takip ederim.",
      prayer: "Düzenli kılmaya çalışıyorum, bazen iş yoğunluğunda zorlanıyorum.",
      reading: "Kişisel gelişim, işletme ve İslami kitaplar okurum. Ayda 1-2 kitap.",
      roleModels: "Babam ve iş hayatındaki mentorum.",
      volunteering: "Haftalık sohbet grubunda düzenli katılımcıyım.",
      personality: "Dışa dönük, enerjik, düzenli, hedef odaklı, yardımsever.",
      redlines: "Güvenilmezlik, dini değerlere saygısızlık, tembellik.",
      genderRelations: "Ciddi ve saygılı. Flört mantığına karşıyım, doğrudan evlilik niyetiyle görüşürüm.",
      strengthsWeaknesses: "Güçlü: Çalışkan, düzenli, sosyal. Zayıf: Bazen işkolik olabiliyorum.",
      values: "Dürüstlük, çalışkanlık, aile, İslami değerler, sadakat.",
      decisionMaking: "Analitik düşünürüm, veriye dayalı karar veririm.",
      importantPeople: "Ailem ve yakın arkadaş çevrem.",
      marriageExpectations: "1. Güven ve sadakat temelli bir evlilik\\n2. Birbirinin gelişimini desteklemek\\n3. İslami değerlerle çocuk yetiştirmek\\n4. Huzurlu ve mutlu bir yuva\\n5. Birlikte seyahat edip yeni yerler keşfetmek",
      marriageEffort: "Katılıyorum. Emek; karşılıklı anlayış, sabır, iletişim ve ortak hedefler için çalışmaktır.",
      spouseRedlines: "Dini hassasiyeti olan, dürüst, çalışkan, aile değerlerine önem veren.",
      spouseYellowlines: "Şehir tercihi, meslek.",
      spouseGreen: "Hedefleri olan, sosyal, seyahat etmeyi seven, sportif, güleryüzlü, iletişime açık.",
      spouseSocialMedia: "Olabilir, sorun değil. Ama mahremiyete dikkat etmeli.",
      ageMin: 30,
      ageMax: 38,
      spousePast: "Kısa süreli görüşmeler olabilir. Resmi evlilik geçirmemiş olmasını tercih ederim.",
      familyRole: "Ailemin fikrini alırım ama son karar benim.",
      relocationView: "Vancouver'da kalmayı tercih ederim.",
      residencyStatus: "Kanada PR",
      currentHousing: "Tek başıma kiralık dairede",
      futureHousing: "Evlilik sonrası Vancouver'da deniz manzaralı bir ev.",
      incomeSource: "Finans sektöründe tam zamanlı çalışıyorum.",
      careerPlans: "Yatırım bankacılığı alanında ilerlemek.",
      budgetViews: "Planlı bütçe, yatırım yapılmalı, birikim önemli.",
      financialFuture: "Uzun vadede yatırım yaparak ev sahibi olmak istiyorum. Konforlu bir yaşam tarzı.",
      pastRelationships: "Yok.",
      currentInterest: "Yok.",
      additionalNotes: "",
      height: 168,
      weight: 60,
      eyeColor: "Yeşil",
      hair: "Kahverengi, düz",
      files: [],
      createdAt: "2025-10-15",
      updatedAt: "2025-10-15"
    },
    {
      id: "cand-sample-f3",
      code: "ADAY-F003",
      gender: "female",
      fullname: "Ayşe Öztürk",
      location: "Kanada, Ottawa",
      contact: "+1 (613) 555-0901",
      consultant: "Danışman C",
      refName: "Fatma Kaya",
      refPhone: "+1 (613) 555-1001",
      refLocation: "Kanada, Ottawa",
      birthDate: "1998-09-25",
      birthReal: "",
      birthPlace: "Konya, Türkiye",
      age: 27,
      nativeLang: "Türkçe",
      otherLangs: "İngilizce - İleri, Arapça - İleri",
      motherInfo: "Hatice Öztürk, Konya, Ev Hanımı, Ottawa, Ev Hanımı",
      fatherInfo: "Ali Öztürk, Konya, İmam, Ottawa, İmam",
      siblingsTotal: "5",
      siblingsBrothers: "3",
      siblingsSisters: "2",
      siblingRank: "4. çocuk",
      education: "Medine İslam Üniversitesi, İslami İlimler, 2016-2020. Ottawa'da Kur'an kursu öğretmeni.",
      hobbies: "Kur'an tilaveti, hat sanatı, doğa yürüyüşleri, çocuklarla vakit geçirme",
      artistic: "Hat sanatı ile uğraşıyorum.",
      media: "Dini sohbetler, eğitici programlar.",
      prayer: "Elhamdülillah 5 vakit namazımı düzenli kılarım.",
      reading: "İslami ilimler, tefsir, hadis. Ayrıca kişisel gelişim kitapları.",
      roleModels: "Peygamber Efendimiz (sav), İslam alimleri, babam.",
      volunteering: "Haftalık sohbet grubunda aktifim. Kadınlara yönelik Kur'an dersleri veriyorum.",
      personality: "Sakin, mütevazı, sabırlı, merhametli, yardımsever.",
      redlines: "Dini hassasiyeti olmayan, yalan söyleyen, namaz kılmayan.",
      genderRelations: "Tamamen İslami çerçevede, aile gözetiminde.",
      strengthsWeaknesses: "Güçlü: Sabırlı, dini bilgisi yüksek, güvenilir. Zayıf: Çekingen olabiliyorum.",
      values: "İslam, ahlak, aile, sadakat, haya, merhamet.",
      decisionMaking: "Aileme danışırım, özellikle babama. İslami referanslara bakarım.",
      importantPeople: "Ailem, özellikle babam.",
      marriageExpectations: "1. İslami bir yuva kurmak\\n2. Salih bir eş\\n3. Çocukları İslam terbiyesiyle yetiştirmek\\n4. Karşılıklı sevgi ve saygı\\n5. Manevi gelişime önem veren bir hayat",
      marriageEffort: "Kesinlikle katılıyorum. Emek; sabır, şükür, anlayış ve sürekli dua demektir.",
      spouseRedlines: "Namazını kılan, İslami hassasiyeti olan, ahlaklı, dürüst.",
      spouseYellowlines: "Eğitim, meslek, şehir.",
      spouseGreen: "Dini bütün, merhametli, ilim sahibi, sabırlı, aile değerlerine bağlı.",
      spouseSocialMedia: "Sosyal medyada olmaması daha iyi olur.",
      ageMin: 27,
      ageMax: 35,
      spousePast: "Geçmiş ilişkisi olmamış olmasını tercih ederim.",
      familyRole: "Ailemin onayı olmazsa olmaz.",
      relocationView: "Eşimin durumuna göre değerlendiririm. Gerekirse taşınırım.",
      residencyStatus: "Kanada vatandaşı",
      currentHousing: "Ailemle birlikte",
      futureHousing: "Eşimin bulunduğu şehirde mütevazı bir ev.",
      incomeSource: "Kur'an kursu öğretmeni.",
      careerPlans: "İslami ilimlerde derinleşmek, belki akademik kariyer.",
      budgetViews: "Kanaatkâr yaşamalı, israftan kaçınmalı.",
      financialFuture: "Mütevazı, huzurlu bir yaşam. Ev sahibi olmak isterim.",
      pastRelationships: "Yok.",
      currentInterest: "Yok.",
      additionalNotes: "",
      height: 162,
      weight: 55,
      eyeColor: "Kahverengi",
      hair: "Kahverengi, düz",
      files: [],
      createdAt: "2025-10-20",
      updatedAt: "2025-10-20"
    }
  ],
  matches: {},
  aiMatches: {}
};

/* ── Toolbar wiring ── */
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('th-load-sample').addEventListener('click', function() {
    window.tool._loadSampleData(SAMPLE_DATA);
  });
  document.getElementById('th-clear').addEventListener('click', function() {
    if (confirm('Clear ALL Matchmaking data? This cannot be undone.')) window.tool._clearData();
  });
  document.getElementById('th-reload').addEventListener('click', function() {
    window.location.reload();
  });
  document.getElementById('th-dump').addEventListener('click', function() {
    window.tool._dump();
    window.tool.notify('DB dumped to console (F12 to view)', 'info');
  });
  document.getElementById('th-toggle-ai').addEventListener('click', function() {
    var enabled = window.tool._toggleAI();
    this.textContent = enabled ? '🤖 AI: ON' : '🤖 AI: OFF';
    this.style.background = enabled ? '#16a34a' : '#dc2626';
    window.tool.notify(enabled ? 'AI matching ENABLED' : 'AI matching DISABLED', 'info');
  });
  document.getElementById('th-toggle-upload').addEventListener('click', function() {
    var enabled = window.tool._toggleUpload();
    this.textContent = enabled ? '📁 Upload: ON' : '📁 Upload: OFF';
    this.style.background = enabled ? '#16a34a' : '#dc2626';
    window.tool.notify(enabled ? 'File upload ENABLED' : 'File upload DISABLED', 'info');
  });
});
</script>"""

# Build the test harness
harness = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Matchmaking — Test Harness</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{css}
</style>
<style>
body {{ padding-top: 28px !important; margin: 0; }}
#th-bar {{ position: fixed; top: 0; left: 0; right: 0; z-index: 9998; background: #0f172a; color: #e6edf5; font-family: system-ui; font-size: 11px; padding: 4px 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
#th-bar strong {{ color: #a78bfa; letter-spacing: 0.5px; }}
#th-bar .sep {{ color: #475569; }}
#th-bar button {{ border: none; padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; font-family: system-ui; font-weight: 600; }}
#th-bar .btn-load {{ background: #7c3aed; color: #fff; }}
#th-bar .btn-clear {{ background: #dc2626; color: #fff; }}
#th-bar .btn-reload {{ background: #16a34a; color: #fff; }}
#th-bar .btn-dump {{ background: #0d9488; color: #fff; }}
#th-bar .hint {{ color: #64748b; font-size: 10px; }}
@keyframes toolFadeIn {{ from {{ opacity: 0; transform: translateY(10px); }} to {{ opacity: 1; transform: translateY(0); }} }}
</style>
</head>
<body>
<div id="th-bar">
  <strong>TEST HARNESS — Matchmaking</strong><span class="sep">|</span>
  <button class="btn-load" id="th-load-sample">Load Sample Data</button>
  <button class="btn-clear" id="th-clear">Clear All</button>
  <button class="btn-reload" id="th-reload">Reload</button>
  <button class="btn-dump" id="th-dump">📋 Dump DB</button>
  <span class="sep">|</span>
  <button id="th-toggle-ai" style="background:#16a34a;color:#fff">🤖 AI: ON</button>
  <button id="th-toggle-upload" style="background:#16a34a;color:#fff">📁 Upload: ON</button>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+R = ReadOnly</span>
  <span class="sep">|</span>
  <span class="hint">Ctrl+Shift+D = Dump DB</span>
  <span class="sep">|</span>
  <span id="th-status" class="hint">Loading...</span>
</div>

{mock_sdk}

{html_body}

<script>
/* ── Load JS ── */
(function() {{
  var status = document.getElementById('th-status');
  status.textContent = 'Loading JS...';
  var script = document.createElement('script');
  script.textContent = {json.dumps(js)};
  script.onload = function() {{ status.textContent = 'Ready \\u2713'; }};
  script.onerror = function() {{ status.textContent = 'JS FAILED \\u2014 check console'; }};
  document.body.appendChild(script);
}})();
</script>

{sample_data_script}

</body>
</html>"""

# Write the test harness
output_path = os.path.join(BASE, 'test-harness.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(harness)

print(f"Test harness generated: {output_path}")
print(f"  HTML: {len(html_body)} chars")
print(f"  CSS:  {len(css)} chars")
print(f"  JS:   {len(js)} chars")
print(f"  Total output: {len(harness)} chars")
