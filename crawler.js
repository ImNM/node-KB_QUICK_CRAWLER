/*
    2021-05-27 B811148 이찬진 
    KISA 은행 공공 api 수업을 듣던도중, 사업자가아니면 테스트 밖에 못한다는걸 알게됨.
    따라서 크롤링 방식으로 구현
    파이썬으로 만들어서 해본사람 있길래 node 로 한번 만들어봄
    기능 : 
    puppeteer로 크로미움 실행
    가상키보드 이미지 인식후 스크린샷찍어서 바뀌는 번호만 짤라서 번호별 이미지 파일 만듬
    tesseract.js 이용해서 버튼 숫자 식별
    스크립트로 버튼 이벤트 강제 실행.

    현재까진 당일 입출내역 로직입니당. 나중에 하드코딩 하세요

*/
const puppeteer = require("puppeteer");
const { createWorker } = require("tesseract.js"); //이미지 광학 인식
const sharp = require("sharp"); //이미지 자르기
require("dotenv").config();

let button = []; // top, left, center , right , bottom 계속 바뀌게 되는 버튼 5개
const KB_QUICK_URL =
  "https://obank.kbstar.com/quics?page=C025255&cc=b028364:b028702#loading";
const HEADLESS = true;
const PATH_KEYBOARD_IMG = "./assets/keyboard.png";

console.log("startiong...");
(async () => {
  const browser = await puppeteer.launch({
    args: ["--disable-web-security"],
    headless: HEADLESS,
  }); //개발모드  false
  const page = await browser.newPage();
  await page.goto(KB_QUICK_URL, {
    waitUntil: "load",
    timeout: 10000,
  });
  //비밀번호 input tag click 이벤트로 가상키보드 func 실행
  await page.evaluate(() => document.getElementById("비밀번호").click());

  let imgurl; //가상키보드 이미지 url 태그검색 - 페이지 리로딩마다 동적으로 바뀜
  await page
    .evaluate(() => {
      imgurl = document.querySelector("img").src;
      return imgurl;
    })
    .then(async (imgurl) => {
      //키보드 이미지로 새창을 열어서 이동
      const page2 = await browser.newPage();
      await page2.goto(imgurl);
      await page2.setViewport({
        //가상키보드 이미지 사이즈 가로 205 세로 336
        width: 205,
        height: 336,
      });
      await page2
        .screenshot({
          //이미지 스크린샷
          path: PATH_KEYBOARD_IMG,
          type: "png",
        })
        .then(async () => {
          //이미지 추출 과정
          page2.close();
          await sharp(PATH_KEYBOARD_IMG)
            .extract({ left: 75, top: 100, width: 55, height: 55 })
            .toFile("./assets/top.png");
          await sharp(PATH_KEYBOARD_IMG)
            .extract({ left: 17, top: 158, width: 55, height: 55 })
            .toFile("./assets/left.png");
          await sharp(PATH_KEYBOARD_IMG)
            .extract({ left: 75, top: 158, width: 55, height: 55 })
            .toFile("./assets/center.png");
          await sharp(PATH_KEYBOARD_IMG)
            .extract({ left: 133, top: 158, width: 55, height: 55 })
            .toFile("./assets/right.png");
          await sharp(PATH_KEYBOARD_IMG)
            .extract({ left: 75, top: 216, width: 55, height: 55 })
            .toFile("./assets/bottom.png");
        });
    })
    .then(() => {
      // 추출된 이미지 인식
      var worker = createWorker();
      (async () => {
        await worker.load();
        await worker.loadLanguage("eng");
        await worker.initialize("eng");
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789", //숫자로 나오는 text scope 제한
        });
        var {
          data: { text },
        } = await worker.recognize("./assets/top.png");
        console.log("top", parseInt(text));
        button.push(parseInt(text));
        var {
          data: { text },
        } = await worker.recognize("./assets/left.png");
        console.log("left", parseInt(text));
        button.push(parseInt(text));
        var {
          data: { text },
        } = await worker.recognize("./assets/center.png");
        console.log("center", parseInt(text));
        button.push(parseInt(text));
        var {
          data: { text },
        } = await worker.recognize("./assets/right.png");
        console.log("right", parseInt(text));
        button.push(parseInt(text));
        var {
          data: { text },
        } = await worker.recognize("./assets/bottom.png");
        console.log("bottom", parseInt(text));
        button.push(parseInt(text));
        console.log("before", button);
        await worker.terminate();
        return button;
      })().then(async (button) => {
        //input 태그들에 값을 입력하는 부분
        const password = process.env.KB_ACCOUNT_PASSWORD;
        const accountAddress = process.env.KB_ACCOUNT_NUMBER;
        const accountId = process.env.KB_ACCOUNT_ID;
        var inpumNumber = [];
        var wherebutton;
        for (var i = 0; i < 5; i++) {
          if (button[i] === 7) {
            wherebutton = i;
          }
        }

        var index = [6, 8, 9, 10, 12];
        var num = index[wherebutton];
        [...password].map((one) => {
          if (one <= 3 || one === 4 || one === 6) {
            inpumNumber.push(parseInt(one) + 1);
          } else {
            inpumNumber.push(num);
          }
        });
        console.log(wherebutton);
        // 가상키보드 area index 2부터 시작합니다.   2,3,4,5,6,7,8,9,10,12
        //                                    1,2,3,4,5,6,7,8,9 , 0 (가상키보드 위치)
        // wherebotton 은 0~4 사이의 값.
        // top : areaindex:5, left:areaindex:8, center:areaindex:9 , right:areaindex:10 , bottom:areaindex:12

        console.log(inpumNumber, "num");
        await page.evaluate(
          (inpumNumber, accountAddress, accountId) => {
            document.querySelector("#account_num").value = accountAddress;
            for (var i = 0; i < 4; i++) {
              document.querySelector("map").areas[inpumNumber[i]].onmousedown();
            }
            document.querySelector("#user_id").value = accountId.toUpperCase();
            document
              .querySelector(
                "#pop_contents > div.btnArea > span > input[type=button]"
              )
              .click();
          },
          inpumNumber,
          accountAddress,
          accountId
        );
        console.log("check");
        let testnum = 0;
        //testnum =
        await page.waitFor(5000);
        // await page.waitForFunction(
        //   document.querySelector(
        //     "#pop_contents > div.btnArea > span:nth-child(2) > input[type=button]"
        //   ).value == "다른계좌조회"
        // );

        let element = await page.$(
          "#pop_contents > table.tType02.s5 > tbody > tr:nth-child(2) > td:nth-child(2)"
        );
        let value = await page.evaluate((el) => el.textContent, element);

        // let number1;
        // await page.evaluate(() => {
        //   document.querySelector(
        //     "#pop_contents > table.tType02.s5 > tbody > tr:nth-child(2) > td:nth-child(2)"
        //   );
        // });
        console.log(value);
        browser.close();
        console.log("asdf...");
      });
    });
})();

console.log("Ending...");

//await page.waitForFunction('document.querySelector(".count").inner‌​Text.length == 7');
