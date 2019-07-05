const download = require( 'image-downloader' );
const zip1 = require( 'node-zip' );
const AWS = require( 'aws-sdk' );
const s3 = new AWS.S3();

const fs = require( 'fs' );
const promise = require( 'bluebird' );
const sha1 = require( 'sha1' );

const request = require( 'request-promise' );


exports.handler = ( event, context ) => {

	let urlArr = [];

	let file = null;

	let buffer = null;
	
	let resultData = [];
	
	

	let options = {
		dest: '/tmp'                  // Save to /path/to/dest/image.jpg
	};

	console.log( `event => ${JSON.stringify( event, null, 2 )}` );

	if( ! event || event == 'undefined' ) {
		return context.succeed( { message: "please check the required parameters" } );
	}
	else {
		urlArr = event.photoArr;
	}
	
	
	let shortener = ( longUrl, orderProductId, orderId) => {

	const apiKey = "apiKey";

	let req = JSON.stringify( { longUrl } );

	let options = {
		method: 'post',
		url: `https://www.googleapis.com/urlshortener/v1/url?key=${apiKey}`,
		body: req,
		headers: {
			'Content-Type': "application/json"
		}
	};

	return request(options)
	.then(r =>{
		resultData.push({ orderProductId , orderId, photoFileUrl : JSON.parse( r ).id });
	});

};


	// urlArr 안에 있는 객체들을 순회
	return promise.map( urlArr, prdArr => {

		let zip = null;

		let zipName = null;

		let index = 1;

		zip = new zip1();

		return promise.map(prdArr.orderProductArray , prd=>{

			console.log(`prdArr result => ${JSON.stringify(prdArr,null,2)}`);
			
			var orderId = null;
			
			if(prdArr.orderId){
				orderId = prdArr.orderId;
			}
			
			

			options[ 'url' ] = prd.url;

			// 이미지 다운로드
			return download.image( options )
			.then( ( { filename, image } ) => {

				console.log( `downloading start!!!` );
				
				console.log( filename );

				// 다운로드 받은 파일들을 zip파일 목록에 셋팅 (파일 갯수만큼 추가)
				zip.file( `${prd.name}`, fs.readFileSync( filename ) );

				// tmp파일에 있는 로컬 사진파일은 삭제
				fs.unlinkSync( filename );

				// zip파일을 생성하기 위한 목록이 완성되었을 때 ( index 체크 )
				if( prdArr.orderProductArray.length == index ) {
					console.log(`index => ${index} , prdArr.length => ${prdArr.orderProductArray.length}`);
					zipName = prdArr.orderProductId;
					console.log(`zipName => ${zipName}`);

					// zip 파일 데이터 생성
					var data = zip.generate( { base64: false, compression: 'DEFLATE' } );

					// tmp 저장소에 zip파일 실제 생성
					fs.writeFileSync( `/tmp/${zipName}`, data, 'binary' );

					// zip파일 read하여 buffer화
					buffer = fs.readFileSync( `/tmp/${zipName}` );

					// s3업로드를 위한 파일 객체생성
					file = getFile( buffer, zipName );

					// s3 업로드 시작
					return upload( file )
					.then( result => {
						console.log(`Upload File Result => ${JSON.stringify( result, null, 2 )}`  );

						return shortener( result.Location, prdArr.orderProductId, orderId  );

					} );
				}
				index ++;
			} ).catch( ( err ) => {
				console.log( err );
				throw err;
			} );

		});

	}).then(_=> {
		console.log(`resultData => ${JSON.stringify(resultData,null,2)}`);
		
		return context.succeed(resultData);

	});

	// TODO implement

};

let upload = ( file ) => {
	console.log( `putObject call!!!!` );
	return s3.upload( file.params ).promise();
};


// s3 업로드를 위한 파일 객체 생성
let getFile = ( buffer, zipName ) => {
	//let fileExt = 'png'
	let file = null;

	let hash = sha1( new Buffer( new Date().toString() ) );

	let buffer1 = buffer;

	let filePath = hash + '/';

	let fileName = `${zipName}.zip`;
	let fileFullName = filePath + fileName;

	let filefullPath = 'https://s3.ap-northeast-2.amazonaws.com/buckeyName/' + fileFullName;

	let params = {
		Bucket: 'BucketName',
		Key: fileFullName,
		Body: buffer1
	};

	let uploadFile = {
		size: buffer.toString( 'ascii' ).length,
		//type: 'application/',
		name: fileName,
		full_path: filefullPath
	};

	file = { params, uploadFile };

	return file;
};

