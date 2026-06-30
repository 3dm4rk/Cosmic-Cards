<?php
require_once __DIR__.'/../config.php';
require_login();
header('Content-Type: application/json; charset=utf-8');
$pdo=db();
$rows=$pdo->query("SELECT username,COALESCE(highest_gps,0) highest_gps FROM users ORDER BY COALESCE(highest_gps,0) DESC,username ASC LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
$out=[];$rank=1;foreach($rows as $r){$out[]=['rank'=>$rank++,'username'=>$r['username'],'highest_gps'=>(int)$r['highest_gps']];}
echo json_encode(['rows'=>$out],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
