<?php

// First a SQL Injection attack V9
//$var = $_POST['var'];
//mysql_query("SELECT * FROM sometable WHERE id = $var");

//
/// XSS example
//
$var = $_POST['var'];
//echo "<div>$var</div>\n";


//
/// 2nd XSS example
//
$var = $_POST['varB'];
echo "<div>$varB</div>\n";

//
/// Forget to terminate user input after a redirect
//
if ($_SESSION['user_logged_in'] !== true) {
  header('Location: /login.php');
}

// Important private logic that shouldn't happen because we've already redirected the user!