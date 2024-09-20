import { Component } from '@angular/core';
import { FormGroup, FormControl } from "@angular/forms";
import { LoadingController } from '@ionic/angular';
import { initializeApp } from 'firebase/app';
import { child, get, getDatabase, Database, ref, set } from "firebase/database";
import { ImageUploadService } from '../image-upload.service';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  highlight_form!: FormGroup
  promo_form!: FormGroup
  contestant_form!: FormGroup
  poll_form!: FormGroup
  poll_result_form!: FormGroup
  database!: Database;
  selectedFile: File | null = null;
  contestants!: any[];
  contestantsLoaded: Boolean = false
  pollingData!: any[];
  pollingDataLoaded: Boolean = false
  currentWeek:any = 0
  uploadPath: string = "uploads"
  uploadSize: number = 1

  constructor(private loadingCtrl: LoadingController, private imageUploadService: ImageUploadService) {
    this.initialiseHighlightsForm()
    this.initialisePromoForm()
    this.initialiseContestantForm()
    this.getContestantsData()
    this.getPollingData()
    this.enableFirebase()
  }

  async getPollingData() {
    this.currentWeek = await this.getObjectForKey("appInfo/week")
    this.pollingData = await this.getObjectForKey("polling/week"+this.currentWeek)
    this.pollingData.sort(function (a: any, b: any) { return b.votes - a.votes; });
    this.initialisePollResultForm()
  }

  async getContestantsData() {
    this.contestants = await this.getObjectForKey("contestants")
    console.log(this.contestants);
    this.contestantsLoaded = true
    this.initialisePollForm()
  }

  initialiseHighlightsForm(){
    this.highlight_form = new FormGroup({
      title: new FormControl(""),
      description: new FormControl("<p></p>"),
      img: new FormControl(false),
      imgUrl: new FormControl("")
    });
  }

  addTag(tag:string){
    if(tag=="BR"){
      this.insertAtCursor("description", "<br>")
    }
    else if(tag=="A"){
      this.insertAtCursor("description", "<a href='url_link'>Watch Now</a>")
    }
  }

  insertAtCursor(id: string, text: string): void {
    const textarea = document.getElementById(id) as HTMLTextAreaElement;
    const textToInsert = text;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = textarea.value.substring(0, cursorPos);
    const afterCursor = textarea.value.substring(cursorPos);
    textarea.value = beforeCursor + textToInsert + afterCursor;
    textarea.selectionStart = textarea.selectionEnd = cursorPos + textToInsert.length;
    textarea.focus();
  }

  async onHighlightsSave() {
    let formData = this.highlight_form.value
    if(formData["title"]=="" || formData["description"]=="" || (formData["img"]=="true" && formData["imgUrl"]=="")){
      alert("Please fill all required fields")
      return
    }
    this.showLoading()
    let highlightsData = await this.getObjectForKey("highlights")
    this.saveHighlight(this.highlight_form.value, highlightsData.length)
    this.initialiseHighlightsForm()
    this.loadingCtrl.dismiss()
  }

  saveHighlight(formData:any, len: number){
    const db = getDatabase();
    set(ref(db, 'highlights/' + len), {
      title: formData['title'],
      desc: formData['description'],
      img : formData['img'] == "true",
      imgUrl : formData['imgUrl']
    });
  }

  initialiseContestantForm(){
    this.contestant_form = new FormGroup({
      name: new FormControl(""),
      desc: new FormControl("Profession <a href='insta_link'>insta_id</a>"),
      url: new FormControl("")
    });
  }

  async onContestantSave(){
    let formData = this.contestant_form.value
    if(formData["name"]=="" || formData["desc"]==""){
      alert("Please fill all required fields")
      return
    }
    this.showLoading()
    await this.saveContestant(this.contestant_form.value, this.contestants.length)
    this.initialiseContestantForm()
    this.loadingCtrl.dismiss()
  }

  async saveContestant(formData:any, len: number){
    const db = getDatabase();
    await set(ref(db, 'contestants/' + len), {
      name: formData['name'],
      url: formData['url'] == "" ? "assets/contestants/"+(len-1)+".jpg" : formData['url'],
      desc: formData['desc'],
      css: 'safe',
      status: 'safe',
      nominated: 0,
    });
  }

  initialisePromoForm(){
    this.promo_form = new FormGroup({
      title: new FormControl(""),
      url: new FormControl("")
    });
  }

  async onPromoSave(){
    let formData = this.promo_form.value
    if(formData["title"]=="" || formData["url"]==""){
      alert("Please fill all required fields")
      return
    }
    this.showLoading()
    let promosData = await this.getObjectForKey("promos")
    this.savePromo(this.promo_form.value, promosData.length)
    this.initialisePromoForm()
    this.loadingCtrl.dismiss()
  }

  savePromo(formData:any, len: number){
    const db = getDatabase();
    set(ref(db, 'promos/' + len), {
      title: formData['title'],
      url: formData['url'],
      eUrl: this.getEmbededUrl(formData['url'])
    });
  }

  getEmbededUrl(link: any){
    let videoID = link.split('/').pop().split('?')[0];
    let eUrl =  "https://www.youtube.com/embed/"+videoID
    return eUrl
  }

  async initialisePollForm(){
    let object:any = {week: new FormControl('')}
    let contestantsCount = this.contestants.length
    for(let i=0; i<contestantsCount; i++){
      object[this.contestants[i]["name"]] = new FormControl(false)
    }
    this.poll_form = new FormGroup(object);
  }

  async onPollSave(){
    let formData = this.poll_form.value
    if(formData["week"]==""){
      alert("Please fill all required fields")
      return
    }
    let poll:any = []
    this.contestants.forEach((contestant) => {
      if(formData[contestant.name]){
        contestant.nominated = Number(contestant.nominated) + 1
        poll.push({
          "imgUrl": contestant.url,
          "imageUrl": contestant.imageUrl,
          "name": contestant.name,
          "votes": 0
        })
      }
    });
    this.savePoll(poll,formData.week,this.contestants)
    this.poll_form.reset()
  }

  savePoll(poll:any[], week: number,contestants: any[]){
    const db = getDatabase();
    set(ref(db, 'polling/' + "week"+week), poll);
    set(ref(db, 'contestants'), contestants);
    set(ref(db, 'appInfo/week'), week);
  }


  async initialisePollResultForm(){
    let object:any = {}
    let pollingCount = this.pollingData.length
    for(let i=0; i<pollingCount; i++){
      object[this.pollingData[i]["name"]] = new FormControl(this.pollingData[i]["votes"])
      object["manual_"+this.pollingData[i]["name"]] = new FormControl(this.pollingData[i]["manualVotes"] ?? 0)
    }
    this.poll_result_form = new FormGroup(object);
    this.pollingDataLoaded = true
  }

  async onPollResultSave(){
    let formData = this.poll_result_form.value
    this.pollingData.forEach((data) => {
      data["votes"] = formData[data.name]
      data["manualVotes"] = formData["manual_"+data.name]
    });
    this.savePollResult()
  }

  savePollResult(){
    const db = getDatabase();
    set(ref(db, 'polling/' + "week"+this.currentWeek), this.pollingData);
  }

  enableFirebase() {
    const firebase = {
      projectId: 'biggbosstelugu-b49b4',
      appId: '1:786263237715:web:1c50fabe75a5ece55192a6',
      databaseURL: 'https://biggbosstelugu-b49b4-default-rtdb.firebaseio.com',
      storageBucket: 'biggbosstelugu-b49b4.appspot.com',
      apiKey: 'AIzaSyCvIdlzjh6tsbUQaiQh_POIuxQtDv0R-VE',
      authDomain: 'biggbosstelugu-b49b4.firebaseapp.com',
      messagingSenderId: '786263237715',
      measurementId: 'G-KN4XPGDRWT',
    };
    const app = initializeApp(firebase);
    this.database = getDatabase(app);
  }

  async getObjectForKey(key: string){
    let response:Object[] = []
    const db = getDatabase();
    const starCountRef = ref(db);
    await get(child(starCountRef, key)).then(async (snapshot) => {
      if (snapshot.exists()) {
        response = snapshot.val();
      }
    })
    return response
  }

  async showLoading() {
    const loading = await this.loadingCtrl.create({
      message: 'Saving...',
      keyboardClose: true
    });

    loading.present();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async upload() {
    if (this.selectedFile) {
      this.showLoading()
      try {
        const res = await this.imageUploadService.uploadImage(this.selectedFile, this.uploadPath, this.uploadSize);
        this.loadingCtrl.dismiss()
        const downloadUrlInput = document.getElementById("downloadUrl") as HTMLTextAreaElement;
        const impPathInput = document.getElementById("imgPath") as HTMLTextAreaElement;
        downloadUrlInput.value = res["downloadURL"]
        impPathInput.value = res["filePath"]
        const chooseFileInput = document.getElementById("chooseFile") as HTMLTextAreaElement;
        chooseFileInput.value = ""
        // You can do more with the download URL, like saving it in your database
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }
  }

  async onPathSave(){
    this.showLoading()
    const givenPathInput = document.getElementById("givenPath") as HTMLTextAreaElement;
    const pathResultInput = document.getElementById("pathResult") as HTMLTextAreaElement;
    const db = getDatabase();
    await set(ref(db, givenPathInput.value), JSON.parse(pathResultInput.value));
    givenPathInput.value = ""
    pathResultInput.value = ""
    this.loadingCtrl.dismiss()
  }

  async fetchPath(){
    const givenPathInput = document.getElementById("givenPath") as HTMLTextAreaElement;
    let res = await this.getObjectForKey(givenPathInput.value)
    const pathResultInput = document.getElementById("pathResult") as HTMLTextAreaElement;
    pathResultInput.value = JSON.stringify(res, undefined, 4)
  }
}
