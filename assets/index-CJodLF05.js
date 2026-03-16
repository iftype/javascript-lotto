(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class Lotto {
  static POLICY = Object.freeze({
    MIN_RANGE: 1,
    MAX_RANGE: 45,
    SIZE: 6
  });
  static ERROR = Object.freeze({
    DUPLICATE: "로또번호가 중복됐습니다",
    INVALID_RANGE: `로또번호가 ${Lotto.POLICY.MIN_RANGE}~${Lotto.POLICY.MAX_RANGE} 범위를 벗어났습니다`,
    INVALID_SIZE: `로또 갯수는 ${Lotto.POLICY.SIZE}개여야 합니다`
  });
  #numbers;
  constructor(numbers) {
    Lotto.validate(numbers);
    this.#numbers = numbers;
  }
  static validate(numbers) {
    const { SIZE, MIN_RANGE, MAX_RANGE } = Lotto.POLICY;
    if (numbers.length !== SIZE) {
      throw new Error(Lotto.ERROR.INVALID_SIZE);
    }
    if (numbers.some((n) => n < MIN_RANGE || MAX_RANGE < n)) {
      throw new Error(Lotto.ERROR.INVALID_RANGE);
    }
    if (numbers.length !== new Set(numbers).size) {
      throw new Error(Lotto.ERROR.DUPLICATE);
    }
  }
  hasNumber(number) {
    return this.#numbers.includes(number);
  }
  getNumbers() {
    return [...this.#numbers];
  }
  static fromList(numbersList) {
    return numbersList.map((numbers) => new Lotto(numbers));
  }
}
const { Random } = MissionUtils;
const lottoPicker = () => {
  const { MIN_RANGE, MAX_RANGE, SIZE } = Lotto.POLICY;
  return Random.pickUniqueNumbersInRange(MIN_RANGE, MAX_RANGE, SIZE);
};
class LottoMachine {
  static UNIT = 1e3;
  static ERROR = {
    NOT_ENOUGH: "돈이 너무 적습니다",
    INVALID_UNIT: "구매 단위로 구매 가능합니다"
  };
  #picker;
  constructor(picker) {
    this.#picker = picker;
  }
  buyLottos(money) {
    const amount = money.getAmount();
    this.#validate(amount);
    const count = Math.floor(amount / LottoMachine.UNIT);
    const lottos = Array.from(
      { length: count },
      () => new Lotto(this.#pickLottoNumbers())
    );
    return { lottos, purchasedMoney: money };
  }
  #validate(amount) {
    if (amount < LottoMachine.UNIT) {
      throw new Error(LottoMachine.ERROR.NOT_ENOUGH);
    }
    if (amount % LottoMachine.UNIT !== 0) {
      throw new Error(LottoMachine.ERROR.INVALID_UNIT);
    }
  }
  #pickLottoNumbers() {
    const numbers = this.#picker();
    return [...numbers].sort((a, b) => a - b);
  }
}
class LottoFacade {
  #purchaseUseCase;
  #statisticsUseCase;
  constructor({ purchaseUseCase: purchaseUseCase2, statisticsUseCase: statisticsUseCase2 }) {
    this.#purchaseUseCase = purchaseUseCase2;
    this.#statisticsUseCase = statisticsUseCase2;
  }
  purchase({ amountRaw }) {
    return this.#purchaseUseCase.execute({ amountRaw });
  }
  getStatistics({
    lottosRaw,
    purchasedRaw,
    winningNumbersRaw,
    bonusNumberRaw
  }) {
    const lottoStatsDto = this.#statisticsUseCase.statisticsLottos({
      lottosRaw,
      winningNumbersRaw,
      bonusNumberRaw,
      purchasedRaw
    });
    return lottoStatsDto;
  }
}
class Money {
  static ERROR = {
    NEGATIVE: "돈은 음수가 될 수 없습니다"
  };
  #amount;
  constructor(amount) {
    this.#validate(amount);
    this.#amount = amount;
  }
  #validate(amount) {
    if (amount < 0) {
      throw new Error(Money.ERROR.NEGATIVE);
    }
  }
  calculateProfitRate(totalPrize) {
    if (this.#amount === 0) return 0;
    const profitRate = totalPrize / this.#amount * 100;
    return Number(profitRate.toFixed(1));
  }
  getAmount() {
    return this.#amount;
  }
}
class PurchaseLottoResponseDto {
  #lottos;
  #purchasedAmount;
  constructor(rawLottos, purchaseAmount) {
    this.#lottos = Object.freeze(rawLottos);
    this.#purchasedAmount = purchaseAmount;
    Object.freeze(this);
  }
  get lottos() {
    return this.#lottos;
  }
  get purchasedAmount() {
    return this.#purchasedAmount;
  }
}
class PurchaseLottoMapper {
  static toDto(lottos, money) {
    const rawLottos = lottos.map((lotto) => lotto.getNumbers());
    const amount = money.getAmount();
    return new PurchaseLottoResponseDto(rawLottos, amount);
  }
}
class PurchaseLottoUseCase {
  #lottoMachine;
  constructor(lottoMachine2) {
    this.#lottoMachine = lottoMachine2;
  }
  execute({ amountRaw }) {
    const money = new Money(amountRaw);
    const { lottos, purchasedMoney } = this.#lottoMachine.buyLottos(money);
    return PurchaseLottoMapper.toDto(lottos, purchasedMoney);
  }
}
class Rank {
  static CONFIG = Object.freeze({
    FIRST: {
      matchCount: 6,
      hasBonus: false,
      prize: 2e9,
      order: 1
    },
    SECOND: {
      matchCount: 5,
      hasBonus: true,
      prize: 3e7,
      order: 2
    },
    THIRD: {
      matchCount: 5,
      hasBonus: false,
      prize: 15e5,
      order: 3
    },
    FOURTH: {
      matchCount: 4,
      hasBonus: false,
      prize: 5e4,
      order: 4
    },
    FIFTH: {
      matchCount: 3,
      hasBonus: false,
      prize: 5e3,
      order: 5
    }
  });
  static findRank(winningMatch, bonusMatch) {
    const found = Object.values(Rank.CONFIG).find(
      ({ matchCount, hasBonus }) => {
        if (matchCount !== winningMatch) return false;
        if (matchCount === 5) return hasBonus === bonusMatch;
        return true;
      }
    );
    return found ?? null;
  }
  static getRankMap() {
    return new Map(
      Object.values(Rank.CONFIG).map((rank) => [
        rank.order,
        { ...rank, count: 0 }
      ])
    );
  }
}
class WinningNumber {
  static ERROR = {
    DUPLICATE: "보너스번호가 중복됐습니다",
    INVALID_RANGE: `로또번호가 ${Lotto.POLICY.MIN_RANGE}~${Lotto.POLICY.MAX_RANGE} 범위를 벗어났습니다`
  };
  #lotto;
  #bonusNumber;
  constructor(numbers, bonusNumber) {
    WinningNumber.validate(numbers, bonusNumber);
    this.#lotto = new Lotto([...numbers]);
    this.#bonusNumber = bonusNumber;
  }
  static validate(numbers, bonusNumber) {
    const { MIN_RANGE, MAX_RANGE } = Lotto.POLICY;
    if (bonusNumber < MIN_RANGE || MAX_RANGE < bonusNumber)
      throw new Error(WinningNumber.ERROR.INVALID_RANGE);
    if (numbers.includes(bonusNumber))
      throw new Error(WinningNumber.ERROR.DUPLICATE);
  }
  getMatchCount(lotto) {
    if (!(lotto instanceof Lotto))
      throw new Error("매개변수로 Lotto객체를 받아야합니다");
    const winningNumbers = this.#lotto.getNumbers();
    const matchWinning = winningNumbers.filter(
      (n) => lotto.hasNumber(n)
    ).length;
    const matchBonus = lotto.hasNumber(this.#bonusNumber);
    return { matchWinning, matchBonus };
  }
  get lotto() {
    return this.#lotto;
  }
  get bonusNumber() {
    return this.#bonusNumber;
  }
}
class StatisticsResponseDto {
  #lottosResult;
  #profitRate;
  constructor(lottosResult, profitRate) {
    this.#lottosResult = Object.freeze(lottosResult);
    this.#profitRate = profitRate;
    Object.freeze(this);
  }
  get lottosResult() {
    return this.#lottosResult;
  }
  get profitRate() {
    return this.#profitRate;
  }
}
class StatisticsMapper {
  static toResponseDto(rankMap, profitRate) {
    const results = [...rankMap.entries()].map(([order, { prize, count, matchCount, hasBonus }]) => ({
      order,
      prize,
      count,
      matchCount,
      hasBonus
    })).sort((a, b) => b.order - a.order);
    return new StatisticsResponseDto(results, profitRate);
  }
}
class StatisticsUseCase {
  static ERROR = {
    ARRAY_EMPTY: "로또를 구매하셔야 합니다"
  };
  #statistics(lotto, winningNumber) {
    const { matchWinning, matchBonus } = winningNumber.getMatchCount(lotto);
    const rank = Rank.findRank(matchWinning, matchBonus);
    return rank;
  }
  statisticsLottos({
    lottosRaw,
    purchasedRaw,
    winningNumbersRaw,
    bonusNumberRaw
  }) {
    const lottos = Lotto.fromList(lottosRaw);
    const purchasedMoney = new Money(purchasedRaw);
    const winningNumber = new WinningNumber(winningNumbersRaw, bonusNumberRaw);
    this.#validate(lottos);
    const rankMap = Rank.getRankMap();
    lottos.forEach((lotto) => {
      const rank = this.#statistics(lotto, winningNumber);
      if (rank) {
        const currentStat = rankMap.get(rank.order);
        rankMap.set(rank.order, {
          ...currentStat,
          count: currentStat.count + 1
        });
      }
    });
    const totalPrizeAmount = [...rankMap.values()].reduce(
      (acc, { prize, count }) => acc + prize * count,
      0
    );
    const profitRate = purchasedMoney.calculateProfitRate(totalPrizeAmount);
    return StatisticsMapper.toResponseDto(rankMap, profitRate);
  }
  #validate(lottos) {
    if (!lottos || lottos.length === 0) {
      throw new Error(StatisticsUseCase.ERROR.ARRAY_EMPTY);
    }
  }
}
const addAttr = ($el, key, value) => {
  if (value === void 0 || value === null) return;
  $el.setAttribute(key, String(value));
};
const create = (tag, attrs = {}) => {
  const $el = document.createElement(tag);
  const { className, text, value, disabled, htmlFor, ...rest } = attrs;
  if (className) $el.className = className;
  if (text !== void 0 && text !== null) $el.textContent = text;
  if (value !== void 0) $el.value = value;
  if (disabled !== void 0) $el.disabled = disabled;
  if (htmlFor) $el.htmlFor = htmlFor;
  Object.entries(rest).forEach(([key, value2]) => addAttr($el, key, value2));
  return $el;
};
const Header = () => {
  const $header = create("header", { className: "app-header" });
  const $h1 = create("h1", {
    text: "🎱 행운의 로또",
    className: "lotto-title"
  });
  $header.append($h1);
  return $header;
};
const Footer = () => {
  const $footer = create("footer", { className: "app-footer" });
  const $p = create("p", {
    className: "footer-label lotto-caption",
    text: "Copyright 2023. woowacourse"
  });
  $footer.append($p);
  return $footer;
};
const PurchaseForm = ({ onPurchase }) => {
  const $section = create("section", { className: "purchase-section" });
  const $form = create("form", { className: "purchase-form" });
  const $label = create("label", {
    className: "purchase-form-label lotto-body",
    text: "구입할 금액을 입력해주세요. ",
    htmlFor: "purchase-amount"
  });
  const $layout = create("div", { className: "purchase-layout" });
  const $input = create("input", {
    id: "purchase-amount",
    type: "number",
    className: "purchase-form-input",
    placeholder: "금액"
  });
  const $button = create("button", {
    type: "submit",
    className: "purchase-form-button lotto-cation",
    text: "구입"
  });
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number($input.value);
    onPurchase(amount);
  });
  $layout.append($input, $button);
  $form.append($label, $layout);
  $section.append($form);
  return $section;
};
const LottoList = ({ lottos }) => {
  const $section = create("section", { className: "lotto-list" });
  const $title = create("p", {
    text: `총 ${lottos.length}개를 구매하였습니다.`,
    className: "lotto-count-text lotto-body"
  });
  $section.append($title);
  const $container = create("div", { className: "lotto-list-container" });
  lottos.forEach((lotto) => {
    const $lottoItem = create("div", { className: "lotto-item lotto-body" });
    const $icon = create("span", {
      text: "🎟️ ",
      className: "lotto-icon lotto-icon "
    });
    const $numbers = create("span", {
      text: lotto.join(", "),
      className: "lotto-number lotto-body"
    });
    $lottoItem.append($icon, $numbers);
    $container.append($lottoItem);
  });
  $section.append($container);
  return $section;
};
const WinningForm = ({ onShowResult }) => {
  const $section = create("section", { className: "winning-section" });
  const $form = create("form", { className: "winning-input-form" });
  const $fieldset = create("fieldset", { className: "winning-fieldset" });
  const $legend = create("legend", {
    text: "지난 주 당첨번호 6개와 보너스 번호 1개를 입력해주세요."
  });
  const $labelRow = create("div", { className: "winning-label-row" });
  const $winningLabel = create("span", {
    text: "당첨 번호",
    className: "winning-label"
  });
  const $bonusLabel = create("label", {
    text: "보너스 번호",
    className: "bonus-label",
    htmlFor: "bonus-number"
  });
  $labelRow.append($winningLabel, $bonusLabel);
  const $inputRow = create("div", { className: "winning-input-row" });
  const $numberInputs = Array.from(
    { length: 6 },
    () => create("input", {
      name: "winning-number",
      type: "number",
      className: "winning-number-input",
      required: true
    })
  );
  const $bonusInput = create("input", {
    type: "number",
    id: "bonus-number",
    className: "bonus-number-input",
    required: true
  });
  $inputRow.append(...$numberInputs, $bonusInput);
  const $submitButton = create("button", {
    type: "submit",
    className: "open-result-button lotto-button",
    text: "결과 확인하기"
  });
  $form.addEventListener("submit", (e) => {
    e.preventDefault();
    const winningNumbers = $numberInputs.map(($input) => Number($input.value));
    const bonusNumber = Number($bonusInput.value);
    onShowResult({ winningNumbers, bonusNumber });
  });
  $fieldset.append($legend, $labelRow, $inputRow);
  $form.append($fieldset, $submitButton);
  $section.append($form);
  return $section;
};
const Main = ({ onPurchase, onShowResult }) => {
  const $main = create("main", { className: "app-main" });
  const $container = create("div", { className: "layout-container" });
  $main.append($container);
  const $title = create("h2", {
    className: "lotto-title",
    text: "🎱 내 번호 당첨 확인 🎱"
  });
  const render = ({ lottos }) => {
    $container.replaceChildren();
    $container.append($title, PurchaseForm({ onPurchase }));
    if (lottos.length > 0) {
      $container.append(LottoList({ lottos }));
      $container.append(WinningForm({ onShowResult }));
    }
  };
  return { $main, render };
};
const Modal = ({ onClose, children }) => {
  const $overlay = create("div", { className: "modal-overlay" });
  const $modal = create("div", { className: "modal" });
  const $closeButton = create("button", {
    className: "modal-close-button",
    text: "✕"
  });
  $closeButton.addEventListener("click", onClose);
  $overlay.addEventListener("click", (e) => {
    if (e.target === $overlay) onClose();
  });
  const open = () => $overlay.classList.add("active");
  const close = () => $overlay.classList.remove("active");
  $modal.append($closeButton, children);
  $overlay.append($modal);
  return { $overlay, open, close };
};
const LottoStatistics = ({ onRetry }) => {
  const $section = create("section", { className: "lotto-statistics-section" });
  const render = ({ lottoResult, profitRate }) => {
    $section.replaceChildren();
    const $title = create("h2", {
      text: "🏆 당첨 통계 🏆",
      className: "statistics-title lotto-subtitle"
    });
    const $table = create("table", { className: "statistics-table" });
    const $thead = create("thead");
    const $headerRow = create("tr");
    ["일치 갯수", "당첨금", "당첨 갯수"].forEach((text) => {
      $headerRow.append(create("th", { text }));
    });
    $thead.append($headerRow);
    const $tbody = create("tbody", { className: "lotto-body" });
    lottoResult.forEach(({ matchCount, hasBonus, count, prize }) => {
      const $row = create("tr");
      const matchText = hasBonus ? `${matchCount}개 + 보너스볼` : `${matchCount}개`;
      const prizeText = prize.toLocaleString();
      const countText = `${count}개`;
      [matchText, prizeText, countText].forEach((text) => {
        $row.append(create("td", { text }));
      });
      $tbody.append($row);
    });
    $table.append($thead, $tbody);
    const $profitRate = create("p", {
      text: `당신의 총 수익률은 ${profitRate}%입니다.`,
      className: "profit-rate"
    });
    const $retryButton = create("button", {
      type: "button",
      className: "retry-button lotto-button",
      text: "다시 시작하기"
    });
    $retryButton.addEventListener("click", onRetry);
    $section.append($title, $table, $profitRate, $retryButton);
  };
  return { $section, render };
};
const App = ($app2, { lottoFacade: lottoFacade2 }) => {
  let state = {
    purchasedAmount: "",
    lottos: []
  };
  const statistics = LottoStatistics({ onRetry });
  const modal = Modal({ onClose, children: statistics.$section });
  const { $main, render } = Main({ onPurchase, onShowResult });
  $app2.append(Header(), $main, modal.$overlay, Footer());
  render(state);
  const setState = (newState) => {
    state = { ...state, ...newState };
    render(state);
  };
  function onPurchase(amountRaw) {
    try {
      const { lottos, purchasedAmount } = lottoFacade2.purchase({ amountRaw });
      setState({ lottos, purchasedAmount });
    } catch (e) {
      alert(e.message);
    }
  }
  function onShowResult({ winningNumbers, bonusNumber }) {
    try {
      const stats = lottoFacade2.getStatistics({
        lottosRaw: state.lottos,
        purchasedRaw: state.purchasedAmount,
        winningNumbersRaw: winningNumbers,
        bonusNumberRaw: bonusNumber
      });
      statistics.render({
        lottoResult: stats.lottosResult,
        profitRate: stats.profitRate
      });
      modal.open();
    } catch (e) {
      alert(e.message);
    }
  }
  function onClose() {
    modal.close();
  }
  function onRetry() {
    setState({
      purchasedAmount: 0,
      lottos: []
    });
    modal.close();
  }
};
const lottoMachine = new LottoMachine(lottoPicker);
const purchaseUseCase = new PurchaseLottoUseCase(lottoMachine);
const statisticsUseCase = new StatisticsUseCase();
const lottoFacade = new LottoFacade({
  purchaseUseCase,
  statisticsUseCase
});
const $app = document.querySelector("#app");
App($app, { lottoFacade });
